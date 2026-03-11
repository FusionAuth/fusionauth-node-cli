import {Command} from "@commander-js/extra-typings";
import chalk from "chalk";


import process from 'node:process';
import fs from 'node:fs'
import { isDockerInstalled } from "../utils.js";



async function createKickstart(kickstartPath: string) {
  const kickstartContent = fs.readFileSync(kickstartPath)
  const kickstartObject = JSON.parse(kickstartContent.toString('utf-8'))

  fs.writeFileSync('./fusionauth/kickstart/kickstart.json', JSON.stringify(kickstartObject, null, 2))


}


const action = async function () {
  const dockerInstalled = isDockerInstalled();
  const cwd = process.cwd()
  console.log(chalk.blue(`Running kickstart.`));

  if (dockerInstalled) {
    // move fusionauth folder to user's project
    fs.cpSync(cwd + '/resources/kickstart/fusionauth', './fusionauth', { recursive: true })
    createKickstart(cwd + '/resources/kickstart/kickstart.json')

    // rename .env.defaults
    fs.renameSync('./fusionauth/.env.defaults', './fusionauth/.env')


    // say next steps
    console.log(chalk.green("Congratulations! You're ready to start your Docker container"))
    console.log(`${chalk.magenta('Step 1: ')}cd fusionauth`)
    console.log(`${chalk.magenta('Step 2: ')}docker compose up -d`)
    console.log(`${chalk.magenta('Step 3: ')}Visit http://localhost:9011`)
    

  } else {
    console.log(chalk.red("Error: You don't have Docker installed. It's the easiest way to get everything you need"))
    console.log(chalk.cyan("Please install Docker. For developers new to Docker, we suggest Orbstack: https://docs.orbstack.dev/quick-start"))
  }
  
  }

export const kickstart = new Command()
  .command('kickstart')
  .action(action)


  // kickstart start
  // kickstart stop