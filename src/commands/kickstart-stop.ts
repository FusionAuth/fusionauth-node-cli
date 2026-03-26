import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { betaWarning, isDockerInstalled } from "../utils.js";
import boxen from "boxen";


const action = async function () {
  betaWarning();

  try {
    if (process.cwd() != process.env.CLI_DIR) throw (chalk.red('Error: Current directory was not kickstarted.'))
    if (!isDockerInstalled()) throw (chalk.red('Error: You need Docker to run.'))

    console.log(chalk.yellow('Stopping FusionAuth...\n'))
    const starting = spawn('docker compose stop', { shell: true, stdio: 'inherit' })
    starting.on('error', e => {
      console.error(e)
    })
    if (starting?.stdout) {
      for await (const data of starting.stdout) {
        console.log(`${chalk.green(`FusionAuth:`)} ${data}`);
      };
    }

    starting.on('close', code => {
      console.log(boxen(`The Docker container is stopped.\nTo start it up again, run ${chalk.green("npx fusionauth kickstart:start")}`, { borderStyle: 'bold', borderColor: 'red', padding: 1 }))
    })


  } catch (err) {
    console.log(err)
  }
}

export const kickstartStop = new Command()
  .command('kickstart:stop')
  .description('Runs docker compose stop in current directory')
  .action(action)
