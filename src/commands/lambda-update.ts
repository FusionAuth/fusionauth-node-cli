import {Command} from '@commander-js/extra-typings';
import {FusionAuthClient} from '@fusionauth/typescript-client';
import {readFile} from 'fs/promises';
import chalk from 'chalk';
import {join} from 'path';
import {errorAndExit} from '../utils.js';
import {apiKeyOption, hostOption} from "../options.js";
import {load as loadYaml} from 'js-yaml';

const action = async function (lambdaId: string, {input, key: apiKey, host}: {
    input: string;
    key: string;
    host: string
}): Promise<void> {
    console.log(`Updating lambda ${lambdaId} on ${host}`);
    try {
        const filename = join(input, lambdaId + ".yaml");
        const data = await readFile(filename, 'utf-8');
        const lambda = loadYaml(data) as object;
        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        const clientResponse = await fusionAuthClient.updateLambda(lambdaId, {lambda} );
        if (!clientResponse.wasSuccessful()) {
            errorAndExit(`Error updating lambda: `, clientResponse);
        }
        console.log(chalk.green(`Lambda updated`));
    }
    catch (e: unknown) {
        errorAndExit(`Error updating lambda: `, e);
    }
}

// noinspection JSUnusedGlobalSymbols
export const lambdaUpdate = new Command('lambda:update')
    .description('Update a lambda on FusionAuth')
    .argument('<lambdaId>', 'The lambda id to update. The lambda is read from the file <id>.yaml in the <input> directory.')
    .option('-i, --input <input>', 'The input directory', './lambdas/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
