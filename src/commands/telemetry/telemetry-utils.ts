import fs from "node:fs"
import { getConfigDir, loadConfig } from "../../utils.js"

export function telemetryUpdate(value: boolean) {
  let config = loadConfig()

  config.globalConfig.telemetry = value
  fs.writeFileSync(getConfigDir() + '/.fa/config.json', JSON.stringify(config.globalConfig, null, 2))
  return config
}