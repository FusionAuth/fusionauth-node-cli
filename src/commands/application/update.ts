import { Command } from "@commander-js/extra-typings";
import { __dirname, betaWarning, errorAndExit, logEvent } from '../../utils.js'
import { apiKeyOption, hostOption } from '../../options.js';
import path from "node:path";
import { readFileSync } from "node:fs";
import chalk from "chalk";
import { FusionAuthClient } from '@fusionauth/typescript-client';
import fs from "node:fs"

function parseData(data: string) {
    let json: string;
    if (data.startsWith('@')) {
        const filePath = data.slice(1);
        try {
            json = fs.readFileSync(filePath, 'utf-8');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            throw new Error(`Error reading --data file "${filePath}": ${message}`);
        }
    } else {
        json = data;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Error parsing --data JSON: ${message}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(
            `--data JSON must be a non-null, non-array object, got ${Array.isArray(parsed) ? 'an array' : parsed === null ? 'null' : typeof parsed}.`
        );
    }
    return parsed;
}



export function setNestedProps(obj: any, path: string, value: any) {
  /* Takes object and dynamically applies a property at any depth
     myprop.somedepth.key = "value" coverts to {myprop: {somedepth: {key: value}}}
  */
  let schema = obj;
  const pList = path.split('.');
  const len = pList.length;
  for (var i = 0; i < len - 1; i++) {
    var elem = pList[i];
    if (!schema[elem]) schema[elem] = {}
    schema = schema[elem];
  }

  schema[pList[len - 1]] = value;

  return schema
}


function displaySuccess(message: string = "Successfully submitted Application update") {
  console.log(chalk.green(message))
}

export function isJSON(string: string) {
  try {
    JSON.parse(string)
    return true
  } catch (e) {
    return false
  }
}

export function splitProp(prop: string) {
  try {
    const [key, ...value] = prop.split("=")
    const joinedValue = value.join("=")
    if (isJSON(joinedValue)) {
      return { key, value: JSON.parse(joinedValue) }
    }
    return { key, value: joinedValue }
  } catch (e: any) {
    throw new Error(e)
  }
}

export const executeUpdateAction = async function (id: string, options: Record<string, any>) {
  const {
    host = 'http://localhost:9011',
    key
  } = options
  const fusionAuthClient = new FusionAuthClient(key, host);

  try {
    logEvent('cli application:update')

    if (!options.data && !options.prop) throw new Error("No --prop or --data was specified")
    if (options?.data) {
      
      const data = await parseData(options.data)
      const { response } = await fusionAuthClient.patchApplication(id, data)
      return {
        success: true,
        patchData: data,
        response
      }    
    }
    if (options?.prop) {
      let data = { application: {} }
      const splitprops = options.prop.map((prop: string) => {
        if (!prop.includes('=')) throw new Error("Property string must be in the syntax <key>=<value>")
        return splitProp(prop)
      })
      splitprops.forEach((prop: any) => setNestedProps(data.application, prop.key, prop.value))
      const { response } = await fusionAuthClient.patchApplication(id, data)
      return {
        success: true,
        patchData: data,
        response
      }   
    }

  } catch (e: any) {
    if (e.statusCode === 404) throw new Error(`Application with ID ${id} does not exist`)

    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message, rawError: e };
  }
}

const action = async (id: string, options: Record<string, any>) => {
  betaWarning()
  const result = await executeUpdateAction(id, options)
  if (!result?.success) {
    errorAndExit(result?.error ?? 'Error updating application.', result?.rawError);
    return;
  }
  displaySuccess(`Applied the following patch\n${JSON.stringify(result.patchData, null, 2)}`)

}

export const appUpdate = new Command()
  .command('application:update')
  .argument('<id>', "The FusionAuth Application ID to update")
  .option('--data <data>', "Full application config as inline JSON or @file.json")
  .option('-p, --prop <prop...>', 'Updates a single property from the application --prop name="My New Name" or --prop oauthConfiguration.authorizedOriginURLs="http://localhost:9011" ')
  .addOption(hostOption)
  .addOption(apiKeyOption)
  .description('Updates an application with data provided via a file, a property, or a command flag.')
  .action(action)
