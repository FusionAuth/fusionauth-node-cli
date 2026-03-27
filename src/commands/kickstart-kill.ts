import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { betaWarning, isDockerInstalled } from "../utils.js";
import boxen from "boxen";
import inquirer from "inquirer";


const action = async function () {
  betaWarning();

  try {
    if (!isDockerInstalled()) throw (chalk.red('Error: You need Docker to run.'))
    
    if (process.cwd() != process.env.CLI_DIR) throw(chalk.red('Error: Current directory was not kickstarted.'))

    inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmation',
        message: 'This is a destructive action. Are you sure you want to kill this container?'

      }
    ])
      .then(async (answers) => {
        if (!answers.confirmation) {
          console.log(chalk.yellow('Cancelling the shutdown. The container is still running'))
          process.exit()
        }

        console.log(chalk.yellow('Killing FusionAuth...\n'))
        try {
          const starting = spawn('docker compose down -v', { shell: true, stdio: 'inherit' })
          starting.on('error', e => {
            console.error(e)
          })
          if (starting?.stdout) {
            for await (const data of starting.stdout) {
              console.log(`${chalk.green(`FusionAuth:`)} ${data}`);
            };
          }

          starting.on('close', code => {
            console.log(boxen(`The Docker container is shut down and the database has been destroyed.\nTo start it up, run ${chalk.green("npx fusionauth kickstart:start")}`, { borderStyle: 'bold', borderColor: 'red', padding: 1 }))
          })

        } catch (e) {
          console.error(e)
        }
      }).catch(e => {
        console.log(chalk.red("The process exited. Please try again."))
      })


  } catch (err) {
    console.log(err)
  }

}

export const kickstartKill = new Command()
  .description('Runs docker compose down in current directory')
  .command('kickstart:kill')
  .action(action)
