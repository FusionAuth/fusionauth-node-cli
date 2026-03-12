import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import inquirer from 'inquirer';

import fs from 'node:fs'
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isDockerInstalled } from "../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createKickstart(kickstartPath: string, answers: any, newDir: string) {
  const kickstartContent = fs.readFileSync(kickstartPath)
  var kickstartObject = JSON.parse(kickstartContent.toString('utf-8'))

  kickstartObject.variables.adminEmail = answers.email;
  kickstartObject.variables.adminPassword = answers.password;
  kickstartObject.variables.applicationName = answers.appName

  fs.writeFileSync(`./${newDir}/kickstart/kickstart.json`, JSON.stringify(kickstartObject, null, 2))
}

const action = async function (dir: string) {
  const dockerInstalled = isDockerInstalled();
  console.log(chalk.blue(`Running kickstart.`));

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
        // move fusionauth folder to user's project
        fs.cpSync(`${__dirname}/resources/kickstart/fusionauth`, `./${dir}`, { recursive: true })
        createKickstart(__dirname + '/resources/kickstart/kickstart.json', answers, dir)

        // rename .env.defaults
        fs.renameSync(`./${dir}/.env.defaults`, `./${dir}/.env`)

        // say next steps
        console.log(chalk.green("Congratulations! You're ready to start your Docker container"))
        console.log(`${chalk.magenta('Step 1: ')}cd ${dir}`)
        console.log(`${chalk.magenta('Step 2: ')}docker compose up -d`)

        console.table({
          Email: answers.email,
          Password: answers.password,
          URL: 'http://localhost:9011/admin'
        })
      }).catch((error) => {
        console.error(error)
      })

  } else {
    console.log(chalk.red("Error: You don't have Docker installed. It's the easiest way to get everything you need"))
    console.log(chalk.cyan("Please install Docker. For developers new to Docker, we suggest Orbstack: https://docs.orbstack.dev/quick-start"))
  }
}

export const kickstart = new Command()
  .command('kickstart')
  .argument('[dir]', 'Optional directory to install FusionAuth', 'fusionauth')
  .action((dir) => action(dir))

// kickstart start
// kickstart stop