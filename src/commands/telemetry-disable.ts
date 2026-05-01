import { Command } from "@commander-js/extra-typings";
import { __dirname, loadConfig, logEvent } from '../utils.js'
import fs from 'node:fs'
import chalk from "chalk";
const action = async function () {
    logEvent('cli do not track')

  try {
    let config = loadConfig()
    config.globalConfig.telemetry = false
    fs.writeFileSync(__dirname + '/.fa/config.json', JSON.stringify(config.globalConfig, null, 2))
    
    console.log(chalk.green(`Usage data will no longer be collected. To re-enable, run ${chalk.bold.bgWhite(' npx fusionauth telemetry:enable ')}.`))
  } catch (err) {
    console.log(err)
  }

}

export const telemetryDisable = new Command()
  .command('telemetry:disable')
  .description('Sets a global config value to disallow telemetry from being collected')
  .action(action)
