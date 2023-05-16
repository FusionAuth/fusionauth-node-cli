import {Command, Option} from 'commander';
import {FusionAuthClient} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import * as fs from 'fs';
import {mkdir, writeFile} from 'fs/promises';
import {templateTypes} from '../template-types.js';
import {reportError, validateOptions} from '../utils.js';

export const themeDownload = new Command('theme:download')
    .description('Download a theme from FusionAuth')
    .argument('<themeId>', 'The theme id to download')
    .option('-o, --output <output>', 'The output directory', './tpl/')
    .option('-k, --key <key>', 'The API key to use')
    .option('-h, --host <url>', 'The FusionAuth host to use', 'http://localhost:9011')
    .addOption(new Option('-t, --types <types...>', 'The types of templates to download').choices(templateTypes).default(templateTypes))
    .action(async (themeId, options) => {
        const {output, apiKey, host, types} = validateOptions(options);

        console.log(`Downloading theme ${themeId} to ${output}`);

        try {
            const theme = await new FusionAuthClient(apiKey, host)
                .retrieveTheme(themeId);

            if (!theme.wasSuccessful()) {
                reportError(`Error downloading theme ${themeId}: `, theme);
                process.exit(1);
            }

            if (!theme.response.theme) {
                reportError(`Error downloading theme ${themeId}: `, 'Theme not found')
                process.exit(1);
            }

            const {templates, stylesheet, defaultMessages, localizedMessages} = theme.response.theme;

            if (!fs.existsSync(output)) {
                await mkdir(output);
            }

            if (types.includes('stylesheet')) {
                await writeFile(`${output}/stylesheet.css`, stylesheet ?? '');
            }

            if (types.includes('messages')) {
                await writeFile(`${output}/defaultMessages.txt`, defaultMessages ?? '');

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
            reportError(`Error downloading theme ${themeId}: `, e);
            process.exit(1);
        }
    });
