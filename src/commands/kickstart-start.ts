import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";

import { exec, execSync, spawn } from 'node:child_process';
import { betaWarning, isDockerInstalled, logEvent } from "../utils.js";
import 'dotenv/config';
import boxen from "boxen";
import yoctoSpinner from "yocto-spinner";
import { startSetup } from "./kickstart/utils.js";




export async function runDocker() {
  return new Promise((resolve, reject) => {
  exec('docker compose up -d',(error, stdout, stderr) => {
  // console.log({error, stdout, stderr})

  if (error) {
    reject(stderr)
  } else {
    resolve(stderr)
  }
  })
  
})
}


export const kickstartStartAction = async function () {
  betaWarning();
  console.log(chalk.yellow('Starting FusionAuth...'))
  const spinner = yoctoSpinner({ text: "Configuring ...\n" }).start()

  try {
    startSetup()
    logEvent('cli command kickstart:start')

    await runDocker().then((result: any) => {
      const messages = result.split('\n')
      const messageDelay = 500
      // console.log({messages})
      const messageDisplays = new Promise((res, rej) => {
        messages.forEach((message:string, i:number, array:[any]) => {
          setTimeout(() => {
            console.info(message)
            if (i === array.length -1) res('Finished messages');

          }, messageDelay*i)
        })
      })

      messageDisplays.then(() => {
        spinner.stop()

        console.log(boxen(`${chalk.magenta('Login URL:')} http://localhost:9011/admin`, { padding: 2, margin: 1, titleAlignment: 'center', borderStyle: 'bold', borderColor: 'green', title: "Your FusionAuth Docker is Running" }))
      }).catch(() => {
        console.log("ERRORED?")
      })

    }).catch(err => {
      throw new Error('Docker was unable to run, check that proper ports are available.')
    })

  } catch (err: any) {
    console.log(err.message)

    console.log("Attempting to gracefully shutdown Docker")
    
    execSync("docker compose down", {stdio: ["inherit", "ignore", "ignore"]})
    spinner.stop()
  }
}

export const kickstartStart = new Command()
  .command('kickstart:start')
  .description('Runs Docker container in the current directory')
  .action(kickstartStartAction)