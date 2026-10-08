import { Command } from "@commander-js/extra-typings";
import { __dirname, logEvent } from '../../utils.js'
import { HTTPClient } from '../../utilities/apply/http-client.js';
import { apiKeyOption, hostOption } from '../../options.js';
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import { inspect } from "node:util";

export function getData(file: string) {
  try {
    const fileLoc = path.resolve(file)
    const contentBuffer = readFileSync(fileLoc).toString('utf-8')
    const contents = JSON.parse(contentBuffer)
    return contents
  } catch (e: any) {
    throw new Error(e)
  }
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
    const [key, value] = prop.split("=")

    if (isJSON(value)) {
      return { key, value: JSON.parse(value) }
    }
    return { key, value }
  } catch (e: any) {
    throw new Error(e)
  }
}

export const action = async function (id: string, options: Record<string, any>): Promise<void> {
  const {
    host = 'http://localhost:9011',
    key
  } = options
  const httpClient = new HTTPClient(host, key);

  try {
    logEvent('cli application:update')

    if (!options.data && !options.prop) throw new Error("No --prop or --data was specified")
    if (options?.data) {
      const data = await getData(options.data)
      const response = await httpClient.executeRequest('PATCH', `/api/application/${id}`, data)
      if (response.status !== 200) throw response.body
      console.log(chalk.green(`Applied the following patch\n`), inspect(data, { showHidden: false, depth: null, colors: true }))
      return
    }
    if (options?.prop) {
      let data = { application: {} }
      const splitprops = options.prop.map((prop: string) => {
        if (!prop.includes('=')) throw new Error("Property string must be in the syntax <key>=<value>")
        return splitProp(prop)
      })
      splitprops.forEach((prop: any) => setNestedProps(data.application, prop.key, prop.value))
      const response = await httpClient.executeRequest('PATCH', `/api/application/${id}`, data)
      if (response.status !== 200) throw response.body

      displaySuccess(`Applied the following patch\n${JSON.stringify(data, null, 2)}`)

      return
    }

  } catch (e: any) {
    if (e?.fieldErrors || e?.generalErrors) {
      console.log(chalk.red('An error ocurred. Patch was not applied. Full error:\n'))
      console.log(inspect(e, { showHidden: false, depth: null, colors: true }))

    } else {
      throw new Error(e)
    }
  }

}
export const appUpdate = new Command()
  .command('application:update')
  .argument('<id>', "The FusionAuth Application ID to update")
  .option('-d, --data <file>', "Apply changes from a named file of JSON that matches the API body for an application update (ignores other flags)")
  .option('-p, --prop <prop...>', 'Updates a single property from the application --prop name="My New Name" or --prop oauthConfiguration.authorizedOriginURLs="http://localhost:9011" ')
  .addOption(hostOption)
  .addOption(apiKeyOption)
  .description('Updates an application with data provided via a file, a property, or a command flag.')
  .action(action)
