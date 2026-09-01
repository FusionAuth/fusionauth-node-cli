import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { betaWarning, confirmOrExit, isDockerInstalled, logEvent } from "../utils.js";
import boxen from "boxen";


const action = async function ({ yes }: { yes: boolean }) {
  betaWarning();

  try {
    if (!isDockerInstalled()) throw (chalk.red('Error: You need Docker to run.'))

    if (process.cwd() != process.env.CLI_DIR) throw(chalk.red('Error: Current directory was not kickstarted.'))
    logEvent('cli command kickstart:kill')

    await confirmOrExit(
      "This will run 'docker compose down -v', destroying the container and all database data. This cannot be undone.",
      yes
    );

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

  } catch (err) {
    console.log(err)
  }

}

export const kickstartKill = new Command()
  .command('kickstart:kill')
  .description('Runs docker compose down in current directory')
  .option('--yes', 'Skip confirmation prompt', false)
  .action(action)
