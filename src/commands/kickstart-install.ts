import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import inquirer from 'inquirer';
import yoctoSpinner from 'yocto-spinner';

import fs from 'node:fs'
import path from "node:path";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isDockerInstalled } from "../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function spinnerText(text: string, spinner: any, interval: number = 500) {
  setTimeout(() => {
    spinner.text = text
  }, interval)
}

async function createKickstart(kickstartPath: string, answers: any, newDir: string) {
  const kickstartContent = fs.readFileSync(kickstartPath)
  var kickstartObject = JSON.parse(kickstartContent.toString('utf-8'))

  kickstartObject.variables.adminEmail = answers.email;
  kickstartObject.variables.adminPassword = answers.password;
  kickstartObject.variables.applicationName = answers.appName

  fs.writeFileSync(`${newDir}/kickstart/kickstart.json`, JSON.stringify(kickstartObject, null, 2))
}

const action = async function (dir: string) {
  const dockerInstalled = isDockerInstalled();
  const directory = path.resolve(dir)
  console.log(chalk.green(`Running kickstart.\n`));

  if (dockerInstalled) {
    inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: "Admin Email Address",
        default: 'admin@example.com'
      },
      {
        type: 'input',
        name: 'password',
        message: "Admin user password",
        default: 'password'
      },
      {
        type: 'input',
        name: 'appName',
        message: 'Name your application',
        default: "Example App"
      }
    ])
      .then((answers) => {
        const spinner = yoctoSpinner({ text: "Building..."}).start()
        setTimeout(() => {
          // move fusionauth folder to user's project
          console.log(chalk.green(`\nTransferring files to ${dir}`))
          fs.cpSync(`${__dirname}/resources/kickstart/fusionauth`, directory, { recursive: true })
        }, 500)
        setTimeout(() => {
          console.log(chalk.green(`Creating Kickstart file`))
          createKickstart(__dirname + '/resources/kickstart/kickstart.json', answers, directory)
        }, 1500)

        setTimeout(() => {
          spinnerText(chalk.green(`Transferring environment variables`), spinner)
          fs.renameSync(`${directory}/.env.defaults`, `${directory}/.env`)
        }, 2500)

        setTimeout(() => {
          spinner.success("Done building!")

          // say next steps
        console.log(chalk.green("================================================================="))
        console.log(chalk.green("=  Congratulations! You're ready to start your Docker container ="))
        console.log(chalk.green("================================================================="))

        console.log(chalk.magentaBright('\nTime to run FusionAuth!'));
        console.log(`${chalk.magenta('Step 1: ')}cd ${dir}`)
        console.log(`${chalk.magenta('Step 2: ')}npx fusionauth start \n`)

        // console.table({
        //   Email: answers.email,
        //   Password: answers.password,
        //   URL: 'http://localhost:9011/admin'
        // })
        }, 3500)

        
      }).catch((error) => {
        console.error(error)
      })

  } else {
    console.log(chalk.red("Error: You don't have Docker installed. It's the easiest way to get everything you need"))
    console.log(chalk.cyan("Please install Docker. For developers new to Docker, we suggest Orbstack: https://docs.orbstack.dev/quick-start"))
  }
}

export const kickstart = new Command()
  .command('kickstart:install')
  .argument('[dir]', 'Optional directory to install FusionAuth', 'fusionauth')
  .action((dir) => action(dir))

// kickstart start
// kickstart stop