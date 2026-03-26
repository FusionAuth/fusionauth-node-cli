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
import { betaWarning, isDockerInstalled } from "../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createKickstart(kickstartPath: string, answers: any, newDir: string) {
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

const action = async function (dir: string) {
  const dockerInstalled = isDockerInstalled();
  const directory = path.resolve(dir)
  betaWarning()

  try {
    if (!dockerInstalled) {
      throw (chalk.red("Error: You don't have Docker installed. It's the easiest way to get everything you need\n") + chalk.cyan("Please install Docker. For developers new to Docker, we suggest Orbstack: https://docs.orbstack.dev/quick-start"))
    }

    if (fs.existsSync(directory)) {
      throw (chalk.red(`Target directory (${directory}) already exists`))
    }
    const parentDir = path.dirname(directory)

    try {
      fs.accessSync(parentDir, fs.constants.W_OK)
    } catch(err) {
      console.error(chalk.red(`Can't write to ${parentDir}. Please check permissions on the directory`))
    }

    inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: "Admin Email Address",
        default: 'admin@example.com',
        validate: function (email) {
          return /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()\.,;\s@\"]+\.{0,1})+([^<>()\.,;:\s@\"]{2,}|[\d\.]+))$/.test(email) ? true : 'Not a valid email address';
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
          } else if(text.length < 8) {
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
          console.log(chalk.green(`\nTransferring files to ${dir}`))
          fs.cpSync(`${__dirname}/resources/kickstart/fusionauth`, directory, { recursive: true })
        }, 500)
        setTimeout(() => {
          console.log(chalk.green(`Creating Kickstart file`))
          if (!fs.existsSync(directory)) throw(chalk.red(`Something went wrong. ${directory} does not exists.`))
          createKickstart(__dirname + '/resources/kickstart/kickstart.json', answers, directory)
        }, 1500)

        setTimeout(() => {
          const postgresPass = crypto.randomUUID()
          const dbPass = crypto.randomUUID()

          console.log(chalk.green(`Transferring environment variables`))
          fs.renameSync(`${directory}/.env.defaults`, `${directory}/.env`)
          fs.appendFileSync(`${directory}/.env`, `\nPOSTGRES_PASSWORD=${postgresPass}\nDATABASE_PASSWORD=${dbPass}`)
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
  .action((dir) => action(dir))