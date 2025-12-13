import {Command} from "@commander-js/extra-typings";
import {reportError} from "../utils.js";
import {watch} from "chokidar";
import Queue from "queue";
import logUpdate from "log-update";
import {EmailTemplate, FusionAuthClient} from "@fusionauth/typescript-client";
import {readFile, realpath} from "fs/promises";
import chalk from "chalk";
import {sep as pathSeparator} from "path";
import logSymbols from "log-symbols";
import {ConditionalKeys} from "type-fest";
import {apiKeyOption, hostOption} from "../options.js";

/**
 * Get all fields of a type that start with a given string
 */
type StartingWith<Set, Needle extends string> = Set extends `${Needle}${infer _X}` ? Set : never;

/**
 * Get all fields that start with `localized`
 */
type localizedFields = StartingWith<keyof EmailTemplate, 'localized'>;
/**
 * Get all fields that start with `default`
 */
type defaultFields = StartingWith<keyof EmailTemplate, 'default'>;

/**
 * Get all (string?) fields that are not localized or default
 */
type otherFields = Exclude<ConditionalKeys<EmailTemplate, string | undefined>, localizedFields | defaultFields>;

// To prevent multiple uploads from happening at once, we use a queue
const q = new Queue({autostart: true, concurrency: 1});

// noinspection JSUnusedGlobalSymbols
export const emailWatch = new Command('email:watch')
    .description('Watch email templates for changes and upload to FusionAuth')
    .option('-i, --input <input>', 'The input directory', './emails/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(async ({input, key: apiKey, host}) => {
        console.log(`Watching email templates in ${input}`);

        const watchedFiles = [
            `${input}/**/*.html`,
            `${input}/**/*.txt`,
        ];

        const absoluteInput = await realpath(input);

        watch(watchedFiles, {
            ignoreInitial: true,
        })
            .on('all', (event, path) => {
                q.push(async () => {
                    logUpdate(`Uploading ${path}`);

                    const content = await readFile(path, 'utf-8');
                    const absolutePath = await realpath(path);

                    const relativePath = absolutePath.substring(absoluteInput.length + 1);

                    const parts = relativePath.split(pathSeparator);

                    let emailTemplateId, locale, fileName;
                    if (parts.length === 2) {
                        emailTemplateId = parts[0];
                        fileName = parts[1];
                    } else if (parts.length === 3) {
                        emailTemplateId = parts[0];
                        locale = parts[1];
                        fileName = parts[2];
                    } else {
                        reportError(`Invalid path ${path}`);
                        return;
                    }

                    const emailTemplate: EmailTemplate | undefined = prepareEmailTemplate(fileName, content, locale);

                    if (!emailTemplate) {
                        logUpdate(`Uploading ${path} - ` + chalk.yellow(`${logSymbols.warning} Unknown file`));
                        logUpdate.done();
                        return;
                    }

                    try {
                        const fusionAuthClient = new FusionAuthClient(apiKey, host);
                        await fusionAuthClient.patchEmailTemplate(emailTemplateId, {emailTemplate});

                        logUpdate(`Uploading ${path} - ` + chalk.green(`${logSymbols.success} Success`));
                        logUpdate.done();
                    } catch (e) {
                        logUpdate(`Uploading ${path} - ` + chalk.red(`${logSymbols.error} Failed`));
                        logUpdate.done();
                        reportError(`Error uploading email template ${emailTemplateId}: `, e);
                    }
                });
            });
    });

const fieldPropertyMap: Record<string, [otherFields] | [defaultFields, localizedFields]> = {
    'body.html': ['defaultHtmlTemplate', 'localizedHtmlTemplates'],
    'body.txt': ['defaultTextTemplate', 'localizedTextTemplates'],
    'subject.txt': ['defaultSubject', 'localizedSubjects'],
    'from_name.txt': ['defaultFromName', 'localizedFromNames'],
    'from_email.txt': ['fromEmail'],
    'name.txt': ['name'],
}

/**
 * Prepare an email template object based on the file name and locale
 * @param fileName The file name, e.g., body.html
 * @param content The content of the file
 * @param locale The locale of the file, if any
 */
const prepareEmailTemplate = (fileName: string, content: string, locale?: string) => {
    if (fieldPropertyMap[fileName] === undefined) {
        return;
    }

    const emailTemplate: EmailTemplate = {};

    const [defaultProp, localeSpecificProp] = fieldPropertyMap[fileName];

    if (localeSpecificProp && locale) {
        emailTemplate[localeSpecificProp] = {[locale]: content};
    } else {
        emailTemplate[defaultProp] = content;
    }

    return emailTemplate;
}
