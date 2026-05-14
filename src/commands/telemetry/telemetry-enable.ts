import { Command } from "@commander-js/extra-typings";
import { __dirname, logEvent } from '../../utils.js'
import chalk from "chalk";
import { telemetryUpdate } from "./telemetry-utils.js";


const action = async function () {
  try {
    telemetryUpdate(true)
    logEvent('cli command telemetry:enable')
    console.log(chalk.green(`Sharing usage data has been re-enabled. To disable, run ${chalk.bold.bgWhite(' npx fusionauth telemetry:disable ')}.`))
  } catch (err) {
    console.log(err)
  }
}

export const telemetryEnable = new Command()
  .command('telemetry:enable')
  .description('Sets a global config value to allow telemetry to be collected')
  .action(action)
