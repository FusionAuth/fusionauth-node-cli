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
    console.log(`Creating lambda ${lambdaId} on ${host}`);
    try {
        const filename = join(input, lambdaId + ".yaml");
        const data = await readFile(filename, 'utf-8');
        const lambda = loadYaml(data) as object;
        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        const clientResponse = await fusionAuthClient.createLambda(lambdaId, { lambda });
        if (!clientResponse.wasSuccessful()) {
            errorAndExit(`Error creating lambda: `, clientResponse);
        }
        console.log(chalk.green(`Lambda created`));
    }
    catch (e: unknown) {
        errorAndExit(`Error creating lambda: `, e);
    }
}

// noinspection JSUnusedGlobalSymbols
export const lambdaCreate = new Command('lambda:create')
    .summary('Create a lambda on FusionAuth')
    .description(`Create a lambda on FusionAuth.
Example lambda .yaml file:

body: |
    function populate(jwt, user, registration) {
    jwt.message = 'Hello World!';
    console.info('Hello World!');
    }
debug: true
engineType: GraalJS
id: f3b3b547-7754-452d-8729-21b50d111505
insertInstant: 1692177291178
lastUpdateInstant: 1692211131823
name: '[ATestLambda]'
type: JWTPopulate
    `)
    .argument('<lambdaId>', 'The lambda id to create. The lambda is read from the file <id>.yaml in the <input> directory.')
    .option('-i, --input <input>', 'The input directory', './lambdas/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
