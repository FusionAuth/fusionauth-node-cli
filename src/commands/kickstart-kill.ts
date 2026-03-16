import {Command} from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { betaWarning, isDockerInstalled } from "../utils.js";
import boxen from "boxen";


const action = async function () {
  betaWarning();
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
        console.log(boxen(`The Docker image is shut down and the database has been destroyed.\nTo start it up, run ${chalk.green("npx fusionauth kickstart:start")}`, {borderStyle: 'bold', borderColor:'red', padding: 1}))
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
  