import {Command} from "@commander-js/extra-typings";
import chalk from "chalk";


import process from 'node:process';
import fs from 'node:fs'
import { execSync, spawn } from 'node:child_process';
import { isDockerInstalled } from "../utils.js";


const action = async function () {
  console.log(chalk.green('Starting FusionAuth...'))

  if (isDockerInstalled()) {
    try {
      const starting = spawn('docker compose up')
      starting.on('error', e => console.log(e))
      // make this work again!!!!
      // for await (const data of starting.stdout) { 
      //   console.log(`${chalk.green(`FusionAuth:`)} ${data}`);
      // };
      starting.on('exit', code => console.log(code))
      starting.on("close", () => {
        console.log(chalk.red('Shutting down...'))
      })
    } catch (e){
      console.error(e)
    }

  } else {
    console.error(chalk.red('Error: You need Docker to run currently.'))
  }

}

export const start = new Command()
  .command('start')
  .action(action)
