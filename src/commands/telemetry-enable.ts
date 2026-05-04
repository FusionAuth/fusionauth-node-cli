import { Command } from "@commander-js/extra-typings";
import { __dirname, loadConfig, logEvent } from '../utils.js'
import fs from 'node:fs'
import chalk from "chalk";
const action = async function () {

  try {
    let config = loadConfig()
    config.globalConfig.telemetry = true
    fs.writeFileSync(__dirname + '/.fa/config.json', JSON.stringify(config.globalConfig, null, 2))
  
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
