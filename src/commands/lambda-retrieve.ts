import {Command} from 'commander';
import {FusionAuthClient} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {existsSync} from 'fs';
import {join} from 'path';
import {mkdir, writeFile} from 'fs/promises';
import * as types from '../types.js';
import * as util from '../utils.js';

const action = async function (lambdaId: string, clioptions: types.CLILambdaOptions) {
    const options = util.validateLambdaOptions(clioptions);
    console.log(`Retrieving lambda ${lambdaId} from ${options.host}`);
    try {
        const fusionAuthClient = new FusionAuthClient(options.apiKey, options.host);
        const clientResponse = await fusionAuthClient.retrieveLambda(lambdaId);
        if (!clientResponse.wasSuccessful())
            util.errorAndExit(`Error retrieving lamba: `, clientResponse);
        if (!existsSync(options.output))
            await mkdir(options.output);
        const filename = join(options.output, clientResponse.response.lambda?.id + ".json");
        await writeFile(filename, util.toJson(clientResponse.response.lambda));
        console.log(chalk.green(`Lambda downloaded to ${filename}`));
    }
    catch (e: unknown) {
        util.errorAndExit(`Error retrieving lamba:`, e);
    }
}

export const lambdaRetrieve = new Command('lambda:retrieve')
    .description('Retrieve a lambda from FusionAuth')
    .argument('<lambdaId>', 'The lambda id to retrieve')
    .option('-o, --output <output>', 'The output directory', './lambdas/')
    .option('-k, --key <key>', 'The API key to use')
    .option('-h, --host <url>', 'The FusionAuth host to use', 'http://localhost:9011')
    .action(action);