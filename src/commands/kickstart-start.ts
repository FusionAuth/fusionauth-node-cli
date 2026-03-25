import {Command} from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { betaWarning, isDockerInstalled } from "../utils.js";
import 'dotenv/config';
import boxen from "boxen";
import yoctoSpinner from "yocto-spinner";


const action = async function () {
  betaWarning();
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

      starting.on('close', () => {
        const spinner = yoctoSpinner({ text: "Configuring ..."}).start()
        setTimeout(()=> {
          spinner.stop()
          console.log(boxen(`${chalk.magenta('Login URL:')} http://localhost:9011/admin`, {padding: 2, margin: 1, titleAlignment: 'center', borderStyle: 'bold', borderColor: 'green', title: "Your FusionAuth Docker is Running"}))
        }, 5000) // Timeout to allow kickstart to run in the Docker
      })
      
    } catch (e){
      console.error(e)
    }

  } else {
    console.error(chalk.red('Error: You need Docker to run.'))
  }

}

export const kickstartStart = new Command()
  .command('kickstart:start')
  .description('Runs Docker container in the current directory')
  .action(action)