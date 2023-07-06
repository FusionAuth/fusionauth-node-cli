import {Command, Option} from 'commander';
import {FusionAuthClient} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {readdir, readFile} from 'fs/promises';
import * as types from '../types.js';
import {getLocaleFromLocalizedMessageFileName, reportError, validateLambdaOptions} from '../utils.js';

const action = async function (lambdaId: string, options: types.CLILambdaOptions) {
    const {apiKey, host} = validateLambdaOptions(options);
    console.log(`Retrieving lambda ${lambdaId} from ${host}`);
    try {
        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        const clientResponse = await fusionAuthClient.retrieveLambda(lambdaId);
        if (!clientResponse.wasSuccessful()) {
            reportError(`Error retrieving lamba ${lambdaId}: `, clientResponse);
            process.exit(1);
        }
        console.log(chalk.green(`Lambda ${lambdaId} was retrieved. It is:`));
        console.log("");
        console.dir(clientResponse.response);
        console.log("");
        console.dir(clientResponse.response.lambda);
        console.log("");
    }
    catch (e: unknown) {
        reportError(`Error retrieving lamba ${lambdaId}:`, e);
        process.exit(1);
    }
}

export const lambdaRetrieve = new Command('lambda:retrieve')
    .description('Retrieve a lambda from FusionAuth')
    .argument('<lambdaId>', 'The lambda id to retrieve')
    .option('-k, --key <key>', 'The API key to use')
    .option('-h, --host <url>', 'The FusionAuth host to use', 'http://localhost:9011')
    .action(action);