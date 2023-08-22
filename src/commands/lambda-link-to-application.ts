import {Command} from '@commander-js/extra-typings';
import {FusionAuthClient, ApplicationRequest} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {errorAndExit} from '../utils.js';
import {apiKeyOption, hostOption} from "../options.js";

const action = async function ( applicationId: string,
                                lambdaId: string,
                                {key: apiKey, host}:
                                    {
                                        key: string;
                                        host: string
                                    }
                                ): Promise<void>
{
    console.log(`Linking lambda ${lambdaId} to application ${applicationId} on ${host}`);
    try {
        const request: ApplicationRequest = {
            "application": {
                "lambdaConfiguration": {
                    "accessTokenPopulateId": lambdaId,
                    "idTokenPopulateId": lambdaId
                }
            }
        };
        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        const clientResponse = await fusionAuthClient.patchApplication(applicationId, request)
        if (!clientResponse.wasSuccessful())
            errorAndExit(`Error linking lambda: `, clientResponse);
        console.log(chalk.green(`Lambda linked`));
    }
    catch (e: unknown) {
        errorAndExit(`Error linking lambda: `, e);
    }
}

// noinspection JSUnusedGlobalSymbols
export const lambdaLinkToApplication = new Command('lambda:link-to-application')
    .summary('Link an existing lambda to an application on FusionAuth')
    .description(`Link an existing lambda to an application on FusionAuth as both the "Access Token populate lambda" and the "Id Token populate lambda".
Example use:
  npx fusionauth lambda:link-to-application e9fdb985-9173-4e01-9d73-ac2d60d1dc8e  f3b3b547-7754-452d-8729-21b50d111505 --key lambda_testing_key;`)
    .argument('<applicationId>', 'The application id to update.')
    .argument('<lambdaId>', 'The lambda id to link to the application.')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
