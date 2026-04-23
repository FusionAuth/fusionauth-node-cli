import { Command } from "@commander-js/extra-typings";
import { __dirname, loadConfig } from '../utils.js'
import fs from 'node:fs'
const action = async function () {

  try {
    let config = loadConfig()
    config.globalConfig.telemetry = true
    fs.writeFileSync(__dirname + '/.fa/config.json', JSON.stringify(config.globalConfig, null, 2))
  } catch (err) {
    console.log(err)
  }

}

export const telemetryEnable = new Command()
  .description('Sets a global config value to allow telemetry to be collected')
  .command('telemetry:enable')
  .action(action)
