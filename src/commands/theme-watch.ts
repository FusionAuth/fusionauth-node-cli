import {Command, Option} from 'commander';
import * as types from '../types.js';
import {watch} from 'chokidar';
import {getLocaleFromLocalizedMessageFileName, reportError, validateThemeOptions} from '../utils.js';
import Queue from 'queue';
import {FusionAuthClient, Theme} from '@fusionauth/typescript-client';
import {readFile} from 'fs/promises';
import logUpdate     from "log-update";
import logSymbols from "log-symbols";
import chalk from "chalk";

// To prevent multiple uploads from happening at once, we use a queue
const q = new Queue({autostart: true, concurrency: 1});

export const themeWatch = new Command('theme:watch')
    .description('Watch a theme for changes and upload to FusionAuth')
    .argument('<themeId>', 'The theme id to watch')
    .option('-i, --input <input>', 'The input directory', './tpl/')
    .option('-k, --key <key>', 'The API key to use')
    .option('-h, --host <url>', 'The FusionAuth host to use', 'http://localhost:9011')
    .addOption(new Option('-t, --types <types...>', 'The types of templates to watch').choices(types.templateTypes).default(types.templateTypes))
    .action((themeId: string, options: types.CLIThemeOptions) => {
        const {input, apiKey, host, types} = validateThemeOptions(options);

        console.log(`Watching theme directory ${input} for changes and uploading to ${themeId}`);

        const watchedFiles: string[] = [];

        if (types.includes('templates')) {
            watchedFiles.push(input + '/**/*.ftl');
        }

        if (types.includes('stylesheet')) {
            watchedFiles.push(input + '/stylesheet.css');
        }

        if (types.includes('messages')) {
            watchedFiles.push(input + '/defaultMessages.txt');
            watchedFiles.push(input + '/localizedMessages.*.txt');
        }

        watch(watchedFiles, {
            ignoreInitial: true,
        })
            .on('all', (event, path) => {
                q.push(async () => {
                    logUpdate(`Uploading ${path}`);

                    const theme: Partial<Theme> = {};
                    const content = await readFile(path, 'utf-8');

                    if (path.endsWith('stylesheet.css')) {
                        theme.stylesheet = content;
                    }

                    if (path.endsWith('defaultMessages.txt')) {
                        theme.defaultMessages = content;
                    }

                    if (path.includes('localizedMessages.') && path.endsWith('.txt')) {
                        const locale = getLocaleFromLocalizedMessageFileName(path);
                        if (!locale) return;
                        theme.localizedMessages = {[locale]: content};
                    }

                    if (path.endsWith('.ftl')) {
                        const name = path.split('/').pop()?.replace('.ftl', '');
                        theme.templates = {[name!]: content};
                    }

                    try {
                        const fusionAuthClient = new FusionAuthClient(apiKey, host);
                        await fusionAuthClient.patchTheme(themeId, {theme});

                        logUpdate(`Uploading ${path} - ` + chalk.green(`${logSymbols.success} Success`));
                        logUpdate.done();
                    } catch (e) {
                        logUpdate(`Uploading ${path} - ` + chalk.red(`${logSymbols.error} Failed`));
                        logUpdate.done();
                        reportError(`Error uploading theme ${themeId}: `, e);
                    }

                    return true;
                });
            });
    });
