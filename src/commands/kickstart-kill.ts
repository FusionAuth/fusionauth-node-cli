import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";

import { spawn } from 'node:child_process';
import { betaWarning, confirmOrExit, isDockerInstalled, logEvent } from "../utils.js";
import boxen from "boxen";

// Dependencies below are injectable for testing — avoids real docker/confirm/exit calls
export interface KillDeps {
  isDockerInstalled?: typeof isDockerInstalled;
  confirmOrExit?: typeof confirmOrExit;
  spawn?: typeof spawn;
}

export const action = async function ({ yes }: { yes: boolean }, deps: KillDeps = {}) {
  const checkDocker = deps.isDockerInstalled ?? isDockerInstalled;
  const confirm = deps.confirmOrExit ?? confirmOrExit;
  const spawnFn = deps.spawn ?? spawn;

  betaWarning();

  try {
    if (!checkDocker()) throw (chalk.red('Error: You need Docker to run.'))

    if (process.cwd() != process.env.CLI_DIR) throw(chalk.red('Error: Current directory was not kickstarted.'))
    logEvent('cli command kickstart:kill')

    await confirm(
      "This will run 'docker compose down -v', destroying the container and all database data. This cannot be undone.",
      yes
    );

    console.log(chalk.yellow('Killing FusionAuth...\n'))
    try {
      const starting = spawnFn('docker compose down -v', { shell: true, stdio: 'inherit' })
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
  .action((options) => action(options))
