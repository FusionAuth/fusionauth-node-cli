import { Command } from "@commander-js/extra-typings";
import { __dirname, logEvent } from '../../utils.js'
import { HTTPClient } from '../../utilities/apply/http-client.js';
import { apiKeyOption, hostOption } from '../../options.js';
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";

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


function displaySuccess(message:string = "Successfully submitted Application update") {
  console.log(chalk.green(message))
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

const action = async function (id:string, options: Record<string, any>): Promise<void> {
  const {
    host = 'http://localhost:9011',
    key
  } = options
  const httpClient = new HTTPClient(host, key);

  try {
    logEvent('cli application:create')

    if (options?.prop) {
      let data = { application: {}}
      const splitprops = options.prop.map((prop:string) => splitProp(prop))
      splitprops.forEach((prop:any) => setNestedProps(data.application, prop.key, prop.value))
      const response = await httpClient.executeRequest('PATCH', `/api/application/${id}`, data)
      displaySuccess(`Applied patch\n${JSON.stringify(data,null,2)}`)

      return
    }

    if (options?.data) {
      const data = await getData(options.data)
      await httpClient.executeRequest('PATCH', `/api/application/${id}`, { application: data })
      displaySuccess(`Applied patch\n${JSON.stringify(data,null,2)}`)
      return
    }

    const apiBody = convertOptionsToApiBody(options)
    await httpClient.executeRequest('PATCH', `/api/application/${id}`, apiBody)
    displaySuccess(`Applied patch\n${JSON.stringify(apiBody,null,2)}`)
    return

  } catch (e:any) {
    console.log(e)
    if (e?.fieldErrors) {
      console.log(e.fieldErrors[0].message)
    }
  }

}
export const appUpdate = new Command()
  .command('application:update')
  .argument('<id>', "The FusionAuth Application ID to update")
  .option('-d, --data <file>', "Apply changes from a named file of JSON that matches the API body for an application update (ignores other flags)")
  .option('--redirect-url <redirectUrl>', 'Oauth2.0 Authorized URL')
  .option('-p, --prop <prop...>', 'Updates a single property from the application --prop name="My New Name" or --prop oauthConfiguration.authorizedOriginURLs="http://localhost:9011" ')
  .option('--example', "Generate an example JSON document showing much of what can be updated via application:update")
  .addOption(hostOption)
  .addOption(apiKeyOption)
  .description('Updates an application with data provided via a file, a property, or a command flag.')
  .action(action)
