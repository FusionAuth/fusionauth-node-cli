import {Command, Option} from 'commander';
import {FusionAuthClient, Templates, Theme} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import * as types from '../types.js';
import {readdir, readFile} from 'fs/promises';
import {getLocaleFromLocalizedMessageFileName, reportError, validateLambdaOptions} from '../utils.js';

const action = async function (themeId: string, options: types.CLILambdaOptions) {
    const {apiKey, host} = validateLambdaOptions(options);

    // console.log(`Uploading theme ${themeId} from ${input}`);

    try {
        // Check if theme exists
        const clientResponse = await new FusionAuthClient(apiKey, host)
            .retrieveTheme(themeId);

        if (!clientResponse.wasSuccessful()) {
            reportError(`Error uploading theme ${themeId}: `, clientResponse);
            process.exit(1);
        }

        const templates = Object.keys(clientResponse.response.theme?.templates ?? {});

        const theme: Partial<Theme> = {};

        // const files = await readdir(input);

        // if (types.includes('stylesheet')) {
            // theme.stylesheet = await readFile(`${input}/stylesheet.css`, 'utf-8');
        // }

        // if (types.includes('messages')) {
        //     theme.defaultMessages = await readFile(`${input}/defaultMessages.txt`, 'utf-8');

        //     for await (const file of files) {
        //         if (!file.startsWith('localizedMessages.')) continue;
        //         const locale = getLocaleFromLocalizedMessageFileName(file);
        //         if (!locale) continue;
        //         theme.localizedMessages = {
        //             ...theme.localizedMessages,
        //             [locale]: await readFile(`${input}/${file}`, 'utf-8')
        //         };
        //     }
        // }



        // const fusionAuthClient = new FusionAuthClient(apiKey, host);
        // await fusionAuthClient.patchTheme(themeId, {theme});
        console.log(chalk.green(`Theme ${themeId} was uploaded successfully`));
    } catch (e: any) {
        reportError(`Error uploading theme ${themeId}:`, e);
        process.exit(1);
    }
}

export const lambdaDelete = new Command('lambda:delete')
    .description('Upload a lambda to FusionAuth')
    .argument('<themeId>', 'The theme id to upload')
    .option('-i, --input <input>', 'The input directory', './tpl/')
    .option('-k, --key <key>', 'The API key to use')
    .option('-h, --host <url>', 'The FusionAuth host to use', 'http://localhost:9011')
    .addOption(new Option('-t, --types <types...>', 'The types of templates to upload').choices(types.templateTypes).default(types.templateTypes))
    .action(action);