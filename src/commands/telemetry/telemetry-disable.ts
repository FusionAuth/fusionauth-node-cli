import { Command } from "@commander-js/extra-typings";
import { __dirname, logEvent } from '../../utils.js'
import chalk from "chalk";
import { telemetryUpdate } from "./telemetry-utils.js";

const action = async function () {
  logEvent('cli do not track')

  try {
    telemetryUpdate(false)
    console.log(chalk.green(`Usage data will no longer be collected. To re-enable, run ${chalk.bold.bgWhite(' npx fusionauth telemetry:enable ')}.`))
  } catch (err) {
    console.log(err)
  }
}

export const telemetryDisable = new Command()
  .command('telemetry:disable')
  .description('Sets a global config value to disallow telemetry from being collected')
  .action(action)
