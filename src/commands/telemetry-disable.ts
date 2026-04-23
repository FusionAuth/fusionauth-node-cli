import { Command } from "@commander-js/extra-typings";
import { __dirname, loadConfig } from '../utils.js'
import fs from 'node:fs'
const action = async function () {

  try {
    let config = loadConfig()
    config.globalConfig.telemetry = false
    fs.writeFileSync(__dirname + '/.fa/config.json', JSON.stringify(config.globalConfig, null, 2))
  } catch (err) {
    console.log(err)
  }

}

export const telemetryDisable = new Command()
  .description('Sets a global config value to disallow telemetry from being collected')
  .command('telemetry:disable')
  .action(action)
