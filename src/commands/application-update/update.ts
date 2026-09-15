import { Command } from "@commander-js/extra-typings";
import { __dirname, logEvent } from '../../utils.js'
import {
  ApplyOptions,
  ExecutionMetrics,
  StepResult,
  StepStatus,
  ErrorCategory,
} from '../../utilities/apply/types.js';
import { HTTPClient } from '../../utilities/apply/http-client.js';
import { apiKeyOption, hostOption } from '../../options.js';
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import { exampleApplicationBody } from "../../utils.js";

function getData(file: string) {
  const fileLoc = path.resolve(file)

  const contentBuffer = readFileSync(fileLoc).toString('utf-8')
  const contents = JSON.parse(contentBuffer)

  return contents

}

function setNestedProps(obj: any, path: string, value: any) {
  /* Takes object and dynamically applies a property at any depth
     myprop.somedepth.key = "value" coverts to {myprop: {somedepth: {key: value}}}
  */
  let schema = obj;  
  const pList = path.split('.');
  const len = pList.length;
  for(var i = 0; i < len-1; i++) {
      var elem = pList[i];
      if( !schema[elem] ) schema[elem] = {}
      schema = schema[elem];
  }

  schema[pList[len-1]] = value;

  return schema
}


function displaySuccess() {

  console.log(chalk.green("Successfully submitted Application update"))

}




export function convertOptionsToApiBody(options: any) {
  let body: Record<string, any> = {
    application: {}
  }
  console.log({ options })
  if (options.redirectUrl) {
    if (!body?.application?.oauthConfiguration) body.application.oauthConfiguration = {}
    body.application.oauthConfiguration.authorizedRedirectURLs = [options.redirectUrl]
  }

  console.log(body)
  return body
}

function splitProp(prop: string) {
  const [key,value] = prop.split("=")
  return {key, value}
}

const action = async function (id: string, options: Record<string, any>): Promise<void> {
  const {
    host = 'http://localhost:9011',
    key
  } = options
  const httpClient = new HTTPClient(host, key);

  if (options?.example) {
    console.log(chalk.yellow("Generating example file in current directory"))
    writeFileSync('./application.example.json', JSON.stringify(exampleApplicationBody, null, 2))
    console.log(chalk.green(`File created at ${path.resolve('./application.example.json')}`))
    return
  }

  if (options?.prop) {
    let data = { application: {}}
    const {key, value} = splitProp(options.prop)
    data.application = await setNestedProps(data.application, `${key}`, value)
    console.log(data)
    const response = await httpClient.executeRequest('PATCH', `/api/application/${id}`, data)
    console.log(response)
    return
  }

  try {
    if (options?.data) {
      const data = await getData(options.data)
      await httpClient.executeRequest('PATCH', `/api/application/${id}`, { application: data })
      displaySuccess()
      return
    }

  } catch (e) {
    console.log(e)
  }

  try {
    const apiBody = convertOptionsToApiBody(options)

    const response = await httpClient.executeRequest('PATCH', `/api/application/${id}`, apiBody)
    console.log(response)
    return
  } catch (err) {
    console.log(err)
  }
}
export const appUpdate = new Command()
  .command('application:update')
  .argument('id', "The FusionAuth Application ID to update")
  .option('-d, --data <file>', "Apply changes from a named file of JSON that matches the API body for an application update (ignores other flags)")
  .option('--redirect-url <redirectUrl>', 'Oauth2.0 Authorized URL')
  .option('-p, --prop <prop>')
  .option('--example', "Generate an example JSON document showing much of what can be updated via application:update")
  .addOption(hostOption)
  .addOption(apiKeyOption)
  .description('Sets a global config value to allow telemetry to be collected')
  .action(action)
