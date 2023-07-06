import {Command} from 'commander';
import {FusionAuthClient, LambdaRequest} from '@fusionauth/typescript-client';
import {readFile} from 'fs/promises';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as types from '../types.js';
import * as util from '../utils.js';

const action = async function (lambdaId: string, clioptions: types.CLILambdaUpdateOptions) {
    const options = util.validateLambdaUpdateOptions(clioptions);
    console.log(`Updating lambda ${lambdaId} on ${options.host}`);
    try {
        const filename = path.join(options.input, lambdaId + ".json");
        const data = await readFile(filename, 'utf-8');
        const lambda = JSON.parse(data);
        const request = { lambda };
        const fusionAuthClient = new FusionAuthClient(options.apiKey, options.host);
        const clientResponse = await fusionAuthClient.updateLambda(lambdaId, request);
        if (!clientResponse.wasSuccessful())
            util.errorAndExit(`Error updating lamba ${lambdaId}: `, clientResponse);
        console.log(chalk.green(`Lambda updated`));
    }
    catch (e: unknown) {
        util.reportError(`Error updating lamba: `, e);
        process.exit(1);
    }
}

export const lambdaUpdate = new Command('lambda:update')
    .description('Update a lambda on FusionAuth')
    .argument('<lambdaId>', 'The lambda id to update. The lambda is read from the file <id>.json in the <input> directory.')
    .option('-i, --input <input>', 'The input directory', './lambdas/')
    .option('-k, --key <key>', 'The API key to use')
    .option('-h, --host <url>', 'The FusionAuth host to use', 'http://localhost:9011')
    .action(action);