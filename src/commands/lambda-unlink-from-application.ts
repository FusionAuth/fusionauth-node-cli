import {Command} from '@commander-js/extra-typings';
import {FusionAuthClient, ApplicationRequest} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {errorAndExit, getApplication} from '../utils.js';
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
    console.log(`Unlinking lambda ${lambdaId} from application ${applicationId} on ${host}`);
    try {
        const request: ApplicationRequest = { "application": { "lambdaConfiguration": {} } };
        const application = await getApplication(applicationId, {key: apiKey, host});
        const accessTokenPopulateId = application.lambdaConfiguration?.accessTokenPopulateId;
        const idTokenPopulateId     = application.lambdaConfiguration?.idTokenPopulateId;

        if (!accessTokenPopulateId && !idTokenPopulateId) {
            errorAndExit(`No existing lambdas were linked`);
        }
        if (accessTokenPopulateId && accessTokenPopulateId == lambdaId) {
            request.application!.lambdaConfiguration!.accessTokenPopulateId = '';
        }
        else {
            request.application!.lambdaConfiguration!.accessTokenPopulateId = accessTokenPopulateId;
        }
        if (idTokenPopulateId && idTokenPopulateId == lambdaId) {
            request.application!.lambdaConfiguration!.idTokenPopulateId = '';
        }
        else {
            request.application!.lambdaConfiguration!.idTokenPopulateId = idTokenPopulateId;
        }

        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        const clientResponse = await fusionAuthClient.patchApplication(applicationId, request)
        if (!clientResponse.wasSuccessful())
            errorAndExit(`Error unlinking lambda: `, clientResponse);
        console.log(chalk.green(`Lambda unlinked`));
    }
    catch (e: unknown) {
        errorAndExit(`Error unlinking lambda: `, e);
    }
}

// noinspection JSUnusedGlobalSymbols
export const lambdaUnlinkFromApplication = new Command('lambda:unlink-from-application')
    .summary('Unlink an existing lambda from an application on FusionAuth')
    .description(`Unlink an existing lambda from an application on FusionAuth from both "Access Token populate lambda" and the "Id Token populate lambda" if it was used as either or both.
Example use:
  npx fusionauth lambda:unlink-from-application e9fdb985-9173-4e01-9d73-ac2d60d1dc8e  f3b3b547-7754-452d-8729-21b50d111505 --key lambda_testing_key;`)
    .argument('<applicationId>', 'The application id to update.')
    .argument('<lambdaId>', 'The lambda id to unlink from the application.')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
