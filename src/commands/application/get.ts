import { Command } from "@commander-js/extra-typings";
import { __dirname, logEvent, errorAndExit, betaWarning } from '../../utils.js'
import { apiKeyOption, hostOption } from '../../options.js';
import path from "node:path";
import { writeFileSync } from "node:fs";
import chalk from "chalk";
import { FusionAuthClient } from '@fusionauth/typescript-client';


export async function executeGet(id: string, options: Record<string, any>) {
  logEvent("cli application:get")
  const {
    host = 'http://localhost:9011',
    key,
    output
  } = options

  if (!host || !key) throw new Error("You must provide a FusionAuth host and an API key")
  try {
    const fusionAuthClient = new FusionAuthClient(key, host);
    const res = await fusionAuthClient.retrieveApplication(id)
    if (output) {
      const fullPath = path.resolve(output);
      await writeFileSync(fullPath, JSON.stringify(res.response, null, 2))
      return {
        success: true,
        fullPath
      }
    } else {
      return {
        success: true,
        data: res.response
      }
    }

  } catch (e: any) {
    if (e.statusCode === 404) return {
      success: false,
      error: "Application does not exist",
      rawError: e
    }

    return {
      success: false,
      error: `The server responded with an error: ${e.statusCode}`,
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
