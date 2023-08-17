import {Command} from '@commander-js/extra-typings';
import {FusionAuthClient} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {existsSync} from 'fs';
import {join} from 'path';
import {mkdir, writeFile} from 'fs/promises';
import {errorAndExit, toJson} from '../utils.js';
import {apiKeyOption, hostOption} from "../options.js";
import {dump} from 'js-yaml';

const action = async function (lambdaId: string, {output, key: apiKey, host}: {
    output: string;
    key: string;
    host: string
}) {
    console.log(`Retrieving lambda ${lambdaId} from ${host}`);
    try {
        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        const clientResponse = await fusionAuthClient.retrieveLambda(lambdaId);
        if (!clientResponse.wasSuccessful())
            errorAndExit(`Error retrieving lambda: `, clientResponse);
        if (!existsSync(output))
            await mkdir(output);
        const filename = join(output, clientResponse.response.lambda?.id + ".yaml");
        const lambdaContent = clientResponse.response.lambda;
        if (lambdaContent)
            lambdaContent.body = lambdaContent?.body?.replace(/\r\n/g, '\n'); // allow newlines in .yaml file
        const yamlData = dump(lambdaContent, { styles: { '!!str': '|' } });
        await writeFile(filename, yamlData);
        console.log(chalk.green(`Lambda downloaded to ${filename}`));
    }
    catch (e: unknown) {
        errorAndExit(`Error retrieving lambda:`, e);
    }
}

// noinspection JSUnusedGlobalSymbols
export const lambdaRetrieve = new Command('lambda:retrieve')
    .description('Retrieve a lambda from FusionAuth')
    .argument('<lambdaId>', 'The lambda id to retrieve')
    .option('-o, --output <output>', 'The output directory', './lambdas/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
