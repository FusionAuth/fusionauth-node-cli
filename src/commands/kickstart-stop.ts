import {Command} from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { betaWarning, isDockerInstalled } from "../utils.js";


const action = async function () {
  betaWarning();
  console.log(chalk.yellow('Stopping FusionAuth...\n'))

  if (isDockerInstalled()) {
    try {
      const starting = spawn('docker compose stop', {shell:true, stdio: 'inherit'})
      starting.on('error', e => {
        console.error(e)
      })
      if (starting?.stdout){
      for await (const data of starting.stdout) { 
        console.log(`${chalk.green(`FusionAuth:`)} ${data}`);
      };}

      starting.on('close', code => {
        console.log(chalk.bgRed('\n==== YOUR FUSIONAUTH DOCKER IS STOPPED ===='))
        console.log('To start it up, run npx fusionauth kickstart:start')
      })

    } catch (e){
      console.error(e)
    }

  } else {
    console.error(chalk.red('Error: You need Docker to run.'))
  }

}

export const kickstartStop = new Command()
  .command('kickstart:stop')
  .description('Runs docker compose stop in current directory')
  .action(action)
  