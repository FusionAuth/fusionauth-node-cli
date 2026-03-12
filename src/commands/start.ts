import {Command} from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { isDockerInstalled } from "../utils.js";


const action = async function () {
  console.log(chalk.yellow('Starting FusionAuth...'))

  if (isDockerInstalled()) {
    try {
      const starting = spawn('docker compose up -d', {shell:true})
      starting.on('error', e => {
        console.log('in on error', e)
        console.log(e)})
      starting.on('close', code => {
        console.log(chalk.green('FusionAuth is running...'))
        console.log('\n')
        console.log(chalk.bgGreen('==== YOUR FUSIONAUTH DOCKER IS RUNNING ===='))
        console.log('Login at http://localhost:9011/admin')
        console.log('Username: <todo>')
        console.log('Password: <todo>')
        console.log('closed', code)
      
      })
      for await (const data of starting.stdout) { 
        console.log(`${chalk.green(`FusionAuth:`)} ${data}`);
        
        if (data.includes(' Maintenance mode complete (no further stages left to execute)')){
          console.log(chalk.bgBlue('FOUND IT!'))
        }

      };
      starting.stdout.on('end', () => {
        console.log('i think output stopped?')
      })
    } catch (e){
      console.log('in the error!')
      console.error(e)
    }

  } else {
    console.error(chalk.red('Error: You need Docker to run.'))
  }

}

export const start = new Command()
  .command('start')
  .action(action)
  
  process.on('SIGINT', () =>{
    
  })
