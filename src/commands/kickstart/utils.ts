import fs from 'node:fs'
import { isDockerInstalled, logEvent } from "../../utils.js";
import chalk from "chalk";



export function startSetup() {
  const cwd = process.cwd()
  if (cwd != process.env.CLI_DIR) throw new Error(chalk.red('Error: Current directory was not kickstarted via the CLI'))
  if (!fs.existsSync('./docker-compose.yml')) throw new Error(chalk.red('Error: Current directory does not contain docker-compose.yml'))
  if (!isDockerInstalled()) throw new Error(chalk.red('Error: You need Docker to run.'))
  if (!fs.existsSync('./kickstart/kickstart.json')) throw new Error(chalk.red('Error: The kickstart.json file does not exist.'))
  logEvent('cli command kickstart:start')
}