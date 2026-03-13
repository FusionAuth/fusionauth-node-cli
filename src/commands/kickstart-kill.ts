import {Command} from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { isDockerInstalled } from "../utils.js";


const action = async function () {
  console.log(chalk.yellow('Killing FusionAuth...\n'))

  if (isDockerInstalled()) {
    try {
      const starting = spawn('docker compose down -v', {shell:true, stdio: 'inherit'})
      starting.on('error', e => {
        console.error(e)
      })
      if (starting?.stdout){
      for await (const data of starting.stdout) { 
        console.log(`${chalk.green(`FusionAuth:`)} ${data}`);
      };}

      starting.on('close', code => {
        console.log(chalk.bgRed('\n==== YOUR FUSIONAUTH DOCKER IS REMOVED ===='))
        console.log('To start it up, run npx fusionauth kickstart:start')
      })

    } catch (e){
      console.error(e)
    }

  } else {
    console.error(chalk.red('Error: You need Docker to run.'))
  }

}

export const kill = new Command()
  .command('kickstart:kill')
  .action(action)
  