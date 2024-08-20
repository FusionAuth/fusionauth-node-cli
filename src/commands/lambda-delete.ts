import {Command} from '@commander-js/extra-typings';
import {FusionAuthClient} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {errorAndExit} from '../utils.js';
import {apiKeyOption, hostOption} from "../options.js";

const action = async function (lambdaId: string, {key: apiKey, host}: {
    key: string;
    host: string
}) {
    console.log(`Deleting lambda ${lambdaId} from ${host}`);
    try {
        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        const clientResponse = await fusionAuthClient.deleteLambda(lambdaId);
        if (!clientResponse.wasSuccessful()) {
            errorAndExit(`Error deleting lambda: `, clientResponse);
        }
        console.log(chalk.green(`Lambda deleted`));
    }
    catch (e: unknown) {
        errorAndExit(`Error deleting lambda: `, e);
    }
}

// noinspection JSUnusedGlobalSymbols
export const lambdaDelete = new Command('lambda:delete')
    .description('Delete a lambda from FusionAuth')
    .argument('<lambdaId>', 'The lambda id to delete')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
