import {Command, Option} from 'commander';
import {FusionAuthClient, Theme} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {TemplateType, templateTypes} from '../template-types.js';
import {readFile} from 'fs/promises';
import {reportError, validateOptions} from '../utils.js';

export const themeUpload = new Command('theme:upload')
    .description('Upload a theme to FusionAuth')
    .argument('<themeId>', 'The theme id to upload')
    .option('-i, --input <input>', 'The input directory')
    .option('-k, --key <key>', 'The API key to use')
    .option('-h, --host <url>', 'The FusionAuth host to use')
    .option('-c, --create', 'Create the theme if it does not exist')
    .addOption(new Option('-t, --types <...types>', 'The types of templates to download').choices(templateTypes))
    .action(async (themeId, options) => {
        const {input, apiKey, host, types, create} = validateOptions(options);

        console.log(`Uploading theme ${themeId} from ${input}`);

        try {
            // Check if theme exists
            const clientResponse = await new FusionAuthClient(apiKey, host)
                .retrieveTheme(themeId);

            if (!clientResponse.wasSuccessful()) {
                reportError(`Error downloading theme ${themeId}: `, clientResponse);
                process.exit(1);
            }

            const themeExists = !!clientResponse.response.theme;
            if (!themeExists && !create) {
                reportError(`Error uploading theme ${themeId}:`, 'Theme does not exist')
                console.log('Use the --create flag to create the theme');
                process.exit(1);
            }

            const theme: Partial<Theme> = {};

            if (types.includes('stylesheet')) {
                theme.stylesheet = await readFile(`${input}/stylesheet.css`, 'utf-8');
            }

            if (types.includes('messages')) {
                theme.defaultMessages = await readFile(`${input}/defaultMessages.txt`, 'utf-8');
                theme.localizedMessages = JSON.parse(await readFile(`${input}/localizedMessages.json`, 'utf-8'));
            }

            if (types.includes('templates')) {
                theme.templates = Object.fromEntries(await Promise.all(Object.entries(theme.templates ?? {}).map(async ([name]) => {
                    return readFile(`${input}/${name}.ftl`, 'utf8')
                        .then((template) => ([name, template])).catch(() => ([]));
                })));
            }

            const fusionAuthClient = new FusionAuthClient(apiKey, host);
            if (themeExists) {
                await fusionAuthClient.patchTheme(themeId, {theme});
                console.log(chalk.green(`Theme ${themeId} was uploaded successfully`));
            } else {
                await fusionAuthClient.createTheme(themeId, {theme});
                console.log(chalk.green(`Theme ${themeId} was created successfully`));
            }
        } catch (e: any) {
            reportError(`Error downloading theme ${themeId}:`, e);
            process.exit(1);
        }
    });
