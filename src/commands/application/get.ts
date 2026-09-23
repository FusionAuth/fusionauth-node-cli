import { Command } from "@commander-js/extra-typings";
import { __dirname, logEvent } from '../../utils.js'
import { HTTPClient } from '../../utilities/apply/http-client.js';
import { apiKeyOption, hostOption } from '../../options.js';
import path from "node:path";
import { writeFileSync } from "node:fs";
import chalk from "chalk";
import { inspect } from "node:util";

const action = async function (id:string, options: Record<string, any>): Promise<void> {

  const {
    host = 'http://localhost:9011',
    key,
    filePath = `./${id}.json`
  } = options
  logEvent('cli application:get')
  try {
    const fullPath = path.resolve(filePath);
    const httpClient = new HTTPClient(host, key);
    const response = await httpClient.executeRequest('GET', `/api/application/${id}`)
    if (response.status != 200) throw response

    writeFileSync(fullPath, JSON.stringify(response?.body, null, 2))
  } catch({body}:any) {
    console.log(chalk.red("The request produced the following error:\n"), inspect(body,{showHidden: false, depth: null, colors: true}))
  }
}
export const appGet = new Command()
  .command('application:get')
  .argument('<id>', "The FusionAuth Application ID to update")
  .option('-o, --output <filePath>', "Path where the data should be stored")
  .addOption(hostOption)
  .addOption(apiKeyOption)
  .description('Updates an application with data provided via a file, a property, or a command flag.')
  .action(action)
  