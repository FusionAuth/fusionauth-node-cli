import {Command, Option} from 'commander';
import {FusionAuthClient, Templates, Theme} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {templateTypes} from '../template-types.js';
import {readdir, readFile} from 'fs/promises';
import {reportError, validateOptions} from '../utils.js';

export const themeUpload = new Command('theme:upload')
    .description('Upload a theme to FusionAuth')
    .argument('<themeId>', 'The theme id to upload')
    .option('-i, --input <input>', 'The input directory')
    .option('-k, --key <key>', 'The API key to use')
    .option('-h, --host <url>', 'The FusionAuth host to use')
    .addOption(new Option('-t, --types <...types>', 'The types of templates to download').choices(templateTypes))
    .action(async (themeId, options) => {
        const {input, apiKey, host, types} = validateOptions(options);

        console.log(`Uploading theme ${themeId} from ${input}`);

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

            if (types.includes('stylesheet')) {
                theme.stylesheet = await readFile(`${input}/stylesheet.css`, 'utf-8');
            }

            if (types.includes('messages')) {
                theme.defaultMessages = await readFile(`${input}/defaultMessages.txt`, 'utf-8');
                try {
                    theme.localizedMessages = JSON.parse(await readFile(`${input}/localizedMessages.json`, 'utf-8'));
                } catch (e) {
                    reportError(`Error parsing localizedMessages.json: `, e);
                    process.exit(1);
                }
            }

            if (types.includes('templates')) {
                const templateFiles = await readdir(input);

                for await (const templateFile of templateFiles) {
                    if (!templateFile.endsWith('.ftl')) continue;

                    const templateName = templateFile.slice(0, -4);
                    const templateContent = await readFile(`${input}/${templateFile}`, 'utf8');

                    if (templates.includes(templateName)) {
                        theme.templates = theme.templates ?? {};
                        theme.templates[templateName as keyof Templates] = templateContent;
                    }
                }
            }

            const fusionAuthClient = new FusionAuthClient(apiKey, host);
            await fusionAuthClient.patchTheme(themeId, {theme});
            console.log(chalk.green(`Theme ${themeId} was uploaded successfully`));
        } catch (e: any) {
            reportError(`Error uploading theme ${themeId}:`, e);
            process.exit(1);
        }
    });
