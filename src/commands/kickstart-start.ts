import {Command} from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { isDockerInstalled } from "../utils.js";


const action = async function () {
  console.log(chalk.yellow('Starting FusionAuth...'))

  if (isDockerInstalled()) {
    try {
      const starting = spawn('docker compose up -d', {shell:true, stdio: 'inherit'})
      starting.on('error', e => {
        console.error(e)
      })
      if (starting?.stdout){
      for await (const data of starting.stdout) { 
        console.log(`${chalk.green(`FusionAuth:`)} ${data}`);
      };}

      starting.on('close', code => {
        // if (code !== 0) throw "There was an error"
        console.log(chalk.green('FusionAuth is running...'))
        console.log('\n')
        console.log(chalk.bgGreen('==== YOUR FUSIONAUTH DOCKER IS RUNNING ===='))
        console.log('Login at http://localhost:9011/admin')
        console.log('Username: <todo>')
        console.log('Password: <todo>')
        console.log('closed', code)
      
      })

    } catch (e){
      console.error(e)
    }

  } else {
    console.error(chalk.red('Error: You need Docker to run.'))
  }

}

export const start = new Command()
  .command('kickstart:start')
  .action(action)