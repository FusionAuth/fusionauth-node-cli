import { Command } from "@commander-js/extra-typings";
import { __dirname, logEvent, errorAndExit, betaWarning } from '../../utils.js'
import { HTTPClient } from '../../utilities/apply/http-client.js';
import { apiKeyOption, hostOption } from '../../options.js';
import path from "node:path";
import { writeFileSync } from "node:fs";
import chalk from "chalk";
import { stdout } from "node:process";
import { inspect } from "node:util";


export async function executeGet(id: string, options: Record<string, any>) {
  logEvent("cli application:get")
  const {
    host = 'http://localhost:9011',
    key,
    output
  } = options

  if (!host || !key) throw new Error("You must provide a FusionAuth host and an API key")
  try {
    const httpClient = new HTTPClient(host, key);
    const response = await httpClient.executeRequest('GET', `/api/application/${id}`)
    if (response.status === 404) throw new Error(`Application with ID ${id} does not exist`)
    if (response.status !== 200) throw response.body || new Error("The server responded with an error code ${response.status}")

    if (output) {
      const fullPath = path.resolve(output);
      await writeFileSync(fullPath, JSON.stringify(response?.body, null, 2))
      return {
        success: true,
        fullPath
    }
    } else {
      return {
        success: true,
        data: response.body
      }
    }


    
  } catch (e: any) {
    return {
      success: false,
      error: e.message,
      rawError: e
    }
  }
}


const action = async function (id: string, options: Record<string, any>): Promise<void> {
  betaWarning();
  logEvent('cli application:get')

  const result = await executeGet(id, options)

  if (!result?.success) {
    errorAndExit(result?.error ?? "An error ocurred while fetching the response.");
    return;
  }
  if (result.fullPath) {
    console.log(chalk.green(`Response written to `) + result.fullPath)
    return 
  }
  if (result.data) {
    console.log(result.data)
  }
  
}

export const appGet = new Command()
  .command('application:get')
  .argument('<id>', "The FusionAuth Application ID to retrieve")
  .option('-o, --output <filePath>', "Path where the data should be stored")
  .addOption(hostOption)
  .addOption(apiKeyOption)
  .description('Retrieves an application by id, writing its data to a local file')
  .action(action)
