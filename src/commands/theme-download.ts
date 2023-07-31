import {Command} from '@commander-js/extra-typings';
import {FusionAuthClient} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {existsSync} from 'fs';
import {mkdir, writeFile} from 'fs/promises';
import {errorAndExit, toString} from '../utils.js';
import {apiKeyOption, hostOption, themeTypeOption} from "../options.js";

// noinspection JSUnusedGlobalSymbols
export const themeDownload = new Command('theme:download')
    .description('Download a theme from FusionAuth')
    .argument('<themeId>', 'The theme id to download')
    .option('-o, --output <output>', 'The output directory', './tpl/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .addOption(themeTypeOption)
    .action(async (themeId: string, {output, key: apiKey, host, types}) => {
        console.log(`Downloading theme ${themeId} to ${output}`);

        try {
            const theme = await new FusionAuthClient(apiKey, host)
                .retrieveTheme(themeId);

            if (!theme.wasSuccessful()) {
                return errorAndExit(`Error downloading theme ${themeId}: `, theme);
            }

            if (!theme.response.theme) {
                return errorAndExit(`Error downloading theme ${themeId}: `, 'Theme not found');
            }

            const {templates, stylesheet, defaultMessages, localizedMessages} = theme.response.theme;

            if (!existsSync(output)) {
                await mkdir(output);
            }

            if (types.includes('stylesheet')) {
                await writeFile(`${output}/stylesheet.css`, toString(stylesheet));
            }

            if (types.includes('messages')) {
                await writeFile(`${output}/defaultMessages.txt`, toString(defaultMessages));

                for await (const [locale, messages] of Object.entries(localizedMessages ?? {})) {
                    await writeFile(`${output}/localizedMessages.${locale}.txt`, messages ?? '');
                }
            }

            if (types.includes('templates')) {
                for await (const [name, template] of Object.entries(templates ?? {})) {
                    await writeFile(`${output}/${name}.ftl`, template);
                }
            }

            console.log(chalk.green(`Theme ${themeId} downloaded to ${output}`));
        } catch (e: any) {
            errorAndExit(`Error downloading theme ${themeId}: `, e);
        }
    });
