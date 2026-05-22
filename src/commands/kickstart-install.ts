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
import { betaWarning, isDirEmpty, isDockerInstalled, logEvent } from "../utils.js";

export const __dirname = dirname(fileURLToPath(import.meta.url));


export function moveResources(targetDir:string) {
  try {
    if (fs.existsSync(targetDir)) throw new Error(chalk.red("The target directory already exists"))

    if (!fs.existsSync(`${__dirname}/resources/kickstart`)) throw new Error(chalk.red("The package's resources don't exist"))

    if (!fs.existsSync(`${__dirname}/resources/kickstart/kickstart.json`)) throw new Error(chalk.red("Kickstart template doesn't exist"))

    if (!fs.existsSync(`${__dirname}/resources/kickstart/fusionauth/.env.defaults`)) throw new Error(chalk.red(".env.defaults file doesn't exist"))

    if (!fs.existsSync(`${__dirname}/resources/kickstart/fusionauth/docker-compose.yml`)) throw new Error(chalk.red("docker-compose.yml file doesn't exist"))
    fs.cpSync(`${__dirname}/resources/kickstart/fusionauth`, targetDir, { recursive: true })

    return fs.readdirSync(targetDir)
  } catch(e) {
    throw(e)
  }
  
}

export async function createKickstart(kickstartPath: string, answers: any, newDir: string) {
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

export function createEnv(directory: string, options: any = {postgresPass: crypto.randomUUID(), dbPass: crypto.randomUUID()}) {
  try {
    const { postgresPass, dbPass } = options
    
    console.log(chalk.green(`Transferring environment variables`))
    fs.renameSync(`${directory}/.env.defaults`, `${directory}/.env`)
    fs.appendFileSync(`${directory}/.env`, `\nPOSTGRES_PASSWORD=${postgresPass}\nDATABASE_PASSWORD=${dbPass}\nCLI_DIR=${directory}`)
  } catch(e) {
    throw(".env file was not able to be created")
  }
}

export function installSetup(dir: string) {
  const directory = path.resolve(dir)

  if (fs.existsSync(directory) && !isDirEmpty(directory)) {
    throw(chalk.redBright(`Error: `) + `Target directory (${chalk.yellow(directory)}) has files.\n\nPlease choose an empty or non-existent directory\n`)
  }

  const parentDir = path.dirname(directory)
  try {
    fs.accessSync(parentDir, fs.constants.W_OK)
  } catch (err) {
    throw(chalk.red(`Can't write to ${parentDir}. Please check permissions on the directory`))
  }

  return directory
}

export const kickstartInstallAction = async function (dir: string) {
  logEvent('cli command kickstart:install')
  
  // Throw exception if no docker
  isDockerInstalled();
  // Display a masthead of this being a beta
  betaWarning()

  try {
    const directory = installSetup(dir)

    inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: "Admin Email Address",
        default: 'admin@example.com',
        validate: function (email) {
          return /(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/.test(email) ? true : 'Not a valid email address';
        }
      },
      {
        type: 'password',
        name: 'password',
        message: "Admin user password",
        mask: true,
        validate: (text) => {
          if (text.length == 0) {
            return 'Custom password is required'
          } else if (text.length < 8) {
            return 'Password must be at least 8 characters (You can change this requirement later in your tenant password settings)'
          } else {
            return true
          }
        }
      },
      {
        type: 'input',
        name: 'appName',
        message: 'Name your application',
        default: "Example App"
      }
    ])
      .then((answers) => {
        const spinner = yoctoSpinner({ text: "Building..." }).start()
        setTimeout(() => {
          // move fusionauth folder to user's project
          moveResources(directory)
          console.log(chalk.green(`\nTransferring files to ${dir}`))
        }, 500)
        setTimeout(() => {
          console.log(chalk.green(`Creating Kickstart file`))
          if (!fs.existsSync(directory)) throw (chalk.red(`Something went wrong. ${directory} does not exists.`))
          createKickstart(__dirname + '/resources/kickstart/kickstart.json', answers, directory)
        }, 1500)

        setTimeout(() => {
          createEnv(directory)
        }, 2500)

        setTimeout(() => {
          spinner.success("Done building!\n")

          console.log(boxen(`You're ready to start your Docker container\n${chalk.magenta(`Step 1:`)} cd ${dir}\n${chalk.magenta("Step 2: ")}npx fusionauth kickstart:start`, { padding: 1, title: "Next Steps", borderColor: "green", borderStyle: 'bold' }))

        }, 3500)

      }).catch((err) => {
        console.error(chalk.yellow('Cancelling kickstart installation...'))
      })
  } catch (e) {
    console.error(e)
  }
}

export const kickstartInstall = new Command()
  .command('kickstart:install')
  .description('Adds a directory with a FusionAuth Docker + Kickstart')
  .argument('[dir]', 'Optional directory to install FusionAuth', 'fusionauth')
  .action((dir) => kickstartInstallAction(dir))