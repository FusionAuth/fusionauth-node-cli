import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import inquirer from 'inquirer';
import yoctoSpinner from 'yocto-spinner';
import boxen from "boxen";
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from "node:path";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { betaWarning, errorAndExit, isDirEmpty, isDockerInstalled, logEvent } from "../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Validation helpers (exported for testing)
// ---------------------------------------------------------------------------

export const EMAIL_REGEX = /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

/**
 * Validates an email address.
 * @returns `true` if valid, otherwise an error message string.
 */
export function validateEmail(email: string): true | string {
  return EMAIL_REGEX.test(email) ? true : 'Not a valid email address';
}

/**
 * Validates the admin password.
 * @returns `true` if valid, otherwise an error message string.
 */
export function validatePassword(password: string): true | string {
  if (password.length === 0) {
    return 'Custom password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters (You can change this requirement later in your tenant password settings)';
  }
  return true;
}

// ---------------------------------------------------------------------------
// Answer resolution (exported for testing)
// ---------------------------------------------------------------------------

export interface InstallOptions {
  adminEmail?: string;
  adminPasswordEnv?: string;
  applicationName?: string;
}

export interface InstallAnswers {
  email: string;
  password: string;
  appName: string;
}

/**
 * We need the intial admin's credentials (email and password) and a name for a
 * starter app. This will take values from command line params if present, then 
 * fall back to prompting the user. 
 * 
 * If all values are supplied then no prompts are shown. This is useful for 
 * unattended or agent-driven installs.
 *
 * Note that the password param names an environment variable to get the password
 * from. This is to protect the password from showing up in process lists or being
 * written to command line history files.
 *
 * @param options     CLI option values (any subset may be provided).
 * @param promptFn    Injected prompt function; defaults to `inquirer.prompt`.
 *                    Pass a mock in tests to avoid real TTY interaction.
 */
export async function resolveInstallAnswers(
  options: InstallOptions,
  promptFn: typeof inquirer.prompt = inquirer.prompt
): Promise<InstallAnswers> {
  // --- Resolve email ---
  let email: string | undefined;
  if (options.adminEmail !== undefined) {
    const result = validateEmail(options.adminEmail);
    if (result !== true) {
      throw new Error(`--admin-email: ${result}`);
    }
    email = options.adminEmail;
  }

  // --- Resolve password ---
  let password: string | undefined;
  if (options.adminPasswordEnv !== undefined) {
    const envValue = process.env[options.adminPasswordEnv];
    if (envValue === undefined) {
      throw new Error(
        `--admin-password-env: environment variable "${options.adminPasswordEnv}" is not set`
      );
    }
    const result = validatePassword(envValue);
    if (result !== true) {
      throw new Error(`--admin-password-env: ${result}`);
    }
    password = envValue;
  }

  // --- Resolve appName ---
  let appName: string | undefined = options.applicationName;

  // --- Prompt for any fields not yet resolved ---
  const questions: import('inquirer').DistinctQuestion[] = [];

  if (email === undefined) {
    questions.push({
      type: 'input',
      name: 'email',
      message: 'Admin Email Address',
      default: 'admin@example.com',
      validate: validateEmail,
    });
  }

  if (password === undefined) {
    questions.push({
      type: 'password',
      name: 'password',
      message: 'Admin user password',
      mask: true,
      validate: validatePassword,
    });
  }

  if (appName === undefined) {
    questions.push({
      type: 'input',
      name: 'appName',
      message: 'Name your application',
      default: 'Example App',
    });
  }

  if (questions.length > 0) {
    const prompted = await promptFn(questions);
    if (email === undefined)    email    = prompted.email as string;
    if (password === undefined) password = prompted.password as string;
    if (appName === undefined)  appName  = prompted.appName as string;
  }

  return { email: email!, password: password!, appName: appName! };
}

// ---------------------------------------------------------------------------
// Kickstart file generation
// ---------------------------------------------------------------------------

async function createKickstart(kickstartPath: string, answers: InstallAnswers, newDir: string) {
  const salt = bcrypt.genSaltSync(10)
  const saltBase = salt.split('$10$')[1];
  const fullHash = bcrypt.hashSync(answers.password, salt)
  const hashedPassword = fullHash.split(salt)[1]
  const kickstartContent = fs.readFileSync(kickstartPath)
  var kickstartObject = JSON.parse(kickstartContent.toString('utf-8'))

  kickstartObject.variables.adminEmail = answers.email;
  kickstartObject.variables.adminPassword = hashedPassword;
  kickstartObject.variables.applicationName = answers.appName;
  kickstartObject.variables.saltPassword = saltBase

  fs.mkdirSync(`${newDir}/kickstart`)
  fs.writeFileSync(`${newDir}/kickstart/kickstart.json`, JSON.stringify(kickstartObject, null, 2))
}

// ---------------------------------------------------------------------------
// Command action
// ---------------------------------------------------------------------------

const action = async function (dir: string, options: InstallOptions) {
  const dockerInstalled = isDockerInstalled();
  const directory = path.resolve(dir)
  logEvent('cli command kickstart:install')

  betaWarning()

  try {
    if (!dockerInstalled) {
      throw (chalk.red("Error: You don't have Docker installed. It's the easiest way to get everything you need\n") + chalk.cyan("Please install Docker. For developers new to Docker, we suggest Orbstack: https://docs.orbstack.dev/quick-start"))
    }

    if (fs.existsSync(directory) && !isDirEmpty(directory)) {
      throw (chalk.redBright(`Error: `) + `Target directory (${chalk.yellow(directory)}) has files.\n\nPlease choose an empty or non-existent directory\n`)
    }

    const parentDir = path.dirname(directory)

    try {
      fs.accessSync(parentDir, fs.constants.W_OK)
    } catch (err) {
      console.error(chalk.red(`Can't write to ${parentDir}. Please check permissions on the directory`))
    }

    let answers: InstallAnswers;
    try {
      answers = await resolveInstallAnswers(options);
    } catch (e: any) {
      errorAndExit(e.message ?? String(e));
      return;
    }

    const spinner = yoctoSpinner({ text: "Building..." }).start()
    setTimeout(() => {
      console.log(chalk.green(`\nTransferring files to ${dir}`))
      fs.cpSync(`${__dirname}/resources/kickstart/fusionauth`, directory, { recursive: true })
    }, 500)
    setTimeout(() => {
      console.log(chalk.green(`Creating Kickstart file`))
      if (!fs.existsSync(directory)) throw (chalk.red(`Something went wrong. ${directory} does not exists.`))
      createKickstart(__dirname + '/resources/kickstart/kickstart.json', answers, directory)
    }, 1500)

    setTimeout(() => {
      const postgresPass = crypto.randomUUID()
      const dbPass = crypto.randomUUID()

      console.log(chalk.green(`Transferring environment variables`))
      fs.renameSync(`${directory}/.env.defaults`, `${directory}/.env`)
      fs.appendFileSync(`${directory}/.env`, `\nPOSTGRES_PASSWORD=${postgresPass}\nDATABASE_PASSWORD=${dbPass}\nCLI_DIR=${directory}`)
    }, 2500)

    setTimeout(() => {
      spinner.success("Done building!\n")
      console.log(boxen(`You're ready to start your Docker container\n${chalk.magenta(`Step 1:`)} cd ${dir}\n${chalk.magenta("Step 2: ")}npx fusionauth kickstart:start`, { padding: 1, title: "Next Steps", borderColor: "green", borderStyle: 'bold' }))
    }, 3500)

  } catch (e) {
    console.error(e)
  }
}

export const kickstartInstall = new Command()
  .command('kickstart:install')
  .description('Adds a directory with a FusionAuth Docker + Kickstart')
  .argument('[dir]', 'Optional directory to install FusionAuth', 'fusionauth')
  .option('--admin-email <email>', 'Admin user email address (skips prompt)')
  .option('--admin-password-env <ENV_VAR>', 'Name of environment variable containing the admin password (skips prompt)')
  .option('--application-name <name>', 'Application name (skips prompt)')
  .action((dir, options) => action(dir, options))
