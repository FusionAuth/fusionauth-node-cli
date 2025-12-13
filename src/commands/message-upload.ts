import {Command} from "@commander-js/extra-typings";
import {getMessageErrorMessage, reportError} from "../utils.js";
import {MessageTemplate, MessageTemplateRequest, SMSMessageTemplate, FusionAuthClient} from "@fusionauth/typescript-client";
import {pathExists} from "fs-extra";
import {lstat, readdir, readFile} from "fs/promises";
import {validate as isUUID} from "uuid";
import logUpdate from "log-update";
import chalk from "chalk";
import logSymbols from "log-symbols";
import merge from "merge";
import removeUndefinedObjects from "remove-undefined-objects";
import {apiKeyOption, hostOption} from "../options.js";

// noinspection JSUnusedGlobalSymbols
export const messageUpload = new Command('message:upload')
    .description('Upload message templates to FusionAuth')
    .argument('[messageTemplateId]', 'The message template id to upload. If not provided, all message templates will be uploaded')
    .option('-i, --input <input>', 'The input directory', './messages/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .option('-o, --overwrite', 'Overwrite the existing message template with the new one. F.e. locales that are not defined in the directory, but on the FusionAuth server will be removed.', false)
    .option('--no-create', 'Create the message template if it does not exist')
    .action(async (messageTemplateId, {input, key: apiKey, host, overwrite, create}) => {
        const errorMessage = getMessageErrorMessage('uploading', messageTemplateId);

        if (messageTemplateId) {
            console.log(`Uploading message template ${messageTemplateId} from ${input}`);
        } else {
            console.log(`Uploading all message templates from ${input}`);
        }

        try {
            const client = new FusionAuthClient(apiKey, host);
            const existingMessageTemplatesIds = await retrieveExistingMessageTemplatesIds(client);

            const messageTemplateIds = [];
            if (!messageTemplateId) {
                const files = await readdir(input);
                for await (const file of files) {
                    // Validate directory
                    if ((await lstat(`${input}/${file}`)).isDirectory() && isUUID(file)) {
                        messageTemplateIds.push(file);
                    }
                }
            } else {
                messageTemplateIds.push(messageTemplateId);
            }

            for await (const templateId of messageTemplateIds) {
                const templateExists = existingMessageTemplatesIds.includes(templateId);
                if (!create && !templateExists) {
                    reportError(`Message template ${templateId} does not exist on the FusionAuth server. Skipping...`);
                    continue;
                }

                const messageTemplateDirectory = `${input}/${templateId}/`;

                logUpdate(`Uploading message template ${templateId}`);

                const messageTemplate: SMSMessageTemplate = {};

                // Read the base data
                messageTemplate.name = await readIfExist(`${messageTemplateDirectory}/name.txt`);
                messageTemplate.type = await readIfExist(`${messageTemplateDirectory}/type.txt`) as any;

                // Read the default template
                messageTemplate.defaultTemplate = await readIfExist(`${messageTemplateDirectory}/template.txt`);

                // Read additional data from JSON if it exists
                const dataContent = await readIfExist(`${messageTemplateDirectory}/data.json`);
                if (dataContent) {
                    try {
                        messageTemplate.data = JSON.parse(dataContent);
                    } catch (e) {
                        reportError(`Invalid JSON in data.json for template ${templateId}`, e);
                    }
                }

                // Read the localized templates
                const locales = await readdir(messageTemplateDirectory);

                for await (const locale of locales) {
                    const localeDirectory = `${messageTemplateDirectory}/${locale}`;
                    const stats = await lstat(localeDirectory).catch(() => null);

                    if (stats?.isDirectory()) {
                        const localizedTemplate = await readIfExist(`${localeDirectory}/template.txt`);
                        if (localizedTemplate) {
                            merge.recursive(messageTemplate, {localizedTemplates: {[locale]: localizedTemplate}});
                        }
                    }
                }

                try {
                    const request: MessageTemplateRequest = {messageTemplate: removeUndefinedObjects.default(messageTemplate)};
                    if (!templateExists) {
                        await client.createMessageTemplate(templateId, request);
                    } else if (overwrite) {
                        await client.updateMessageTemplate(templateId, request);
                    } else {
                        await client.patchMessageTemplate(templateId, request);
                    }

                    logUpdate(`Uploading message template ${templateId} - ` + chalk.green(`${logSymbols.success} Success`));
                    logUpdate.done();
                } catch (e) {
                    logUpdate(`Uploading message template ${templateId} - ` + chalk.red(`${logSymbols.error} Failed`));
                    logUpdate.done();
                    reportError(`Error uploading message template ${templateId}: `, e);
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
 * Retrieve all existing message templates
 * @param client FusionAuth client
 */
const retrieveExistingMessageTemplatesIds = async (client: FusionAuthClient): Promise<string[]> => {
    const existingMessageTemplates = await client.retrieveMessageTemplates();
    return existingMessageTemplates.response.messageTemplates?.map(template => <string>template.id) ?? [];
}
