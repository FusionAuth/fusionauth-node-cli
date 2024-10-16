import {Command} from "@commander-js/extra-typings";
import {getEmailErrorMessage, reportError} from "../utils.js";
import {EmailTemplate, EmailTemplateRequest, FusionAuthClient} from "@fusionauth/typescript-client";
import {pathExists} from "fs-extra";
import {lstat, readdir, readFile} from "fs/promises";
import {validate as isUUID} from "uuid";
import logUpdate from "log-update";
import chalk from "chalk";
import logSymbols from "log-symbols";
import merge from "merge";
import removeUndefinedObjects from "remove-undefined-objects";
import {apiKeyOption, hostOption} from "../options.js";

const fileNames = ['body.html', 'body.txt', 'subject.txt', 'from_name.txt'];
const properties: (keyof EmailTemplate)[] = ['localizedHtmlTemplates', 'localizedTextTemplates', 'localizedSubjects', 'localizedFromNames'];

// noinspection JSUnusedGlobalSymbols
export const emailUpload = new Command('email:upload')
    .description('Download email templates from FusionAuth')
    .argument('[emailTemplateId]', 'The email template id to upload. If not provided, all email templates will be uploaded')
    .option('-i, --input <input>', 'The input directory', './emails/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .option('-o, --overwrite', 'Overwrite the existing email template with the new one. F.e. locales that are not defined in the directory, but on the FusionAuth server will be removed.', false)
    .option('--no-create', 'Create the email template if it does not exist')
    .action(async (emailTemplateId, {input, key: apiKey, host, overwrite, create}) => {
        const errorMessage = getEmailErrorMessage('uploading', emailTemplateId);

        if (emailTemplateId) {
            console.log(`Uploading email template ${emailTemplateId} from ${input}`);
        } else {
            console.log(`Uploading all email templates from ${input}`);
        }

        try {
            const client = new FusionAuthClient(apiKey, host);
            const existingEmailTemplatesIds = await retrieveExistingEmailTemplatesIds(client);

            const emailTemplateIds = [];
            if (!emailTemplateId) {
                const files = await readdir(input);
                for await (const file of files) {
                    // Validate directory
                    if ((await lstat(`${input}/${file}`)).isDirectory() && isUUID(file)) {
                        emailTemplateIds.push(file);
                    }
                }
            } else {
                emailTemplateIds.push(emailTemplateId);
            }

            for await (const templateId of emailTemplateIds) {
                const templateExists = existingEmailTemplatesIds.includes(templateId);
                if (!create && !templateExists) {
                    reportError(`Email template ${templateId} does not exist on the FusionAuth server. Skipping...`);
                    continue;
                }

                const emailTemplateDirectory = `${input}/${templateId}/`;


                logUpdate(`Uploading email template ${templateId}`);

                const emailTemplate: EmailTemplate = {};

                // Read the base data
                emailTemplate.name = await readIfExist(`${emailTemplateDirectory}/name.txt`);
                emailTemplate.fromEmail = await readIfExist(`${emailTemplateDirectory}/from_email.txt`);

                // Read the default locale
                emailTemplate.defaultHtmlTemplate = await readIfExist(`${emailTemplateDirectory}/body.html`);
                emailTemplate.defaultTextTemplate = await readIfExist(`${emailTemplateDirectory}/body.txt`);
                emailTemplate.defaultSubject = await readIfExist(`${emailTemplateDirectory}/subject.txt`);
                emailTemplate.defaultFromName = await readIfExist(`${emailTemplateDirectory}/from_name.txt`);

                // Read the locales
                const locales = await readdir(emailTemplateDirectory);

                for await (const locale of locales) {
                    const localeDirectory = `${emailTemplateDirectory}/${locale}`;
                    const stats = await lstat(localeDirectory);

                    if (stats.isDirectory()) {
                        for (let i = 0; i < fileNames.length; i++) {
                            const fileContent = await readIfExist(localeDirectory + '/' + fileNames[i]);

                            if (fileContent) {
                                merge.recursive(emailTemplate, {[properties[i]]: {[locale]: fileContent}});
                            }
                        }
                    }
                }

                try {
                    const request: EmailTemplateRequest = {emailTemplate: removeUndefinedObjects.default(emailTemplate)};
                    if (!templateExists) {
                        await client.createEmailTemplate(templateId, request);
                    } else if (overwrite) {
                        await client.updateEmailTemplate(templateId, request);
                    } else {
                        await client.patchEmailTemplate(templateId, request);
                    }

                    logUpdate(`Uploading email template ${templateId} - ` + chalk.green(`${logSymbols.success} Success`));
                    logUpdate.done();
                } catch (e) {
                    logUpdate(`Uploading email template ${templateId} - ` + chalk.red(`${logSymbols.error} Failed`));
                    logUpdate.done();
                    reportError(`Error uploading email template ${templateId}: `, e);
                }
            }

        } catch (e: any) {
            reportError(errorMessage, e);
            process.exit(1);
        }
    });

/**
 * Read a file if it exists and has content, otherwise return undefined
 * @param path
 */
const readIfExist = async (path: string): Promise<string | undefined> => {
    if (await pathExists(path)) {
        const content = await readFile(path, 'utf-8');
        if (content) {
            return content;
        }
    }
    return undefined;
}

/**
 * Retrieve all existing email templates
 * @param client FusionAuth client
 */
const retrieveExistingEmailTemplatesIds = async (client: FusionAuthClient): Promise<string[]> => {
    const existingEmailTemplate = await client.retrieveEmailTemplates();
    return existingEmailTemplate.response.emailTemplates?.map(template => <string>template.id) ?? [];
}
