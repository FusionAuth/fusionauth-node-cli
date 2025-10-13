import {Command} from "@commander-js/extra-typings";
import {getMessageErrorMessage, getMessageSuccessMessage, reportError} from "../utils.js";
import {MessageTemplate, SMSMessageTemplate, FusionAuthClient} from "@fusionauth/typescript-client";
import {mkdir, writeFile} from "fs/promises";
import chalk from "chalk";
import {emptyDir, pathExists} from "fs-extra";
import {apiKeyOption, hostOption} from "../options.js";
import {existsSync} from "fs";

// noinspection JSUnusedGlobalSymbols
export const messageDownload = new Command('message:download')
    .description('Download message templates from FusionAuth')
    .argument('[messageTemplateId]', 'The message template id to download. If not provided, all message templates will be downloaded')
    .option('-o, --output <output>', 'The output directory', './messages/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .option('-c, --clean', 'Clean the output directory before downloading', false)
    .action(async (messageTemplateId, {output, key: apiKey, host, clean}) => {

        let clientResponse;
        const errorMessage = getMessageErrorMessage('download', messageTemplateId);

        if (messageTemplateId) {
            console.log(`Downloading message template ${messageTemplateId} to ${output}`);
        } else {
            console.log(`Downloading all message templates to ${output}`);
        }

        try {
            if (clean) {
                const cleanDirectory = messageTemplateId ? `${output}/${messageTemplateId}` : output;
                if (await pathExists(cleanDirectory)) {
                    console.log(`Cleaning ${cleanDirectory}`);
                    await emptyDir(cleanDirectory);
                }
            }

            const client = new FusionAuthClient(apiKey, host);

            if (messageTemplateId) {
                clientResponse = await client.retrieveMessageTemplate(messageTemplateId);
            } else {
                clientResponse = await client.retrieveMessageTemplates();
            }

            if (!clientResponse.wasSuccessful()) {
                reportError(errorMessage, clientResponse);
                process.exit(1);
            }

            let messageTemplates: MessageTemplate[];
            if (messageTemplateId && clientResponse.response.messageTemplate) {
                messageTemplates = [clientResponse.response.messageTemplate];
            } else {
                messageTemplates = clientResponse.response.messageTemplates ?? []
            }

            for await (const messageTemplate of messageTemplates) {
                const messageTemplateId = messageTemplate.id;
                const messageTemplateDirectory = `${output}/${messageTemplateId}/`;

                if (!existsSync(messageTemplateDirectory)) {
                    await mkdir(messageTemplateDirectory, {recursive: true});
                }

                await writeFile(`${messageTemplateDirectory}/name.txt`, messageTemplate.name ?? '');
                await writeFile(`${messageTemplateDirectory}/type.txt`, messageTemplate.type ?? '');

                // Export the default message template (only for SMS templates)
                const smsTemplate = messageTemplate as SMSMessageTemplate;
                await writeFile(`${messageTemplateDirectory}/template.txt`, smsTemplate.defaultTemplate ?? '');

                // Export localized message templates
                const locales = getLocalesFromMessageTemplates(smsTemplate);
                for (const locale of locales) {
                    const localeDirectory = `${messageTemplateDirectory}/${locale}/`;
                    if (!existsSync(localeDirectory)) {
                        await mkdir(localeDirectory);
                    }

                    await writeFile(`${localeDirectory}/template.txt`, smsTemplate.localizedTemplates?.[locale] ?? '');
                }

                // Export additional data as JSON if it exists
                if (messageTemplate.data && Object.keys(messageTemplate.data).length > 0) {
                    await writeFile(`${messageTemplateDirectory}/data.json`, JSON.stringify(messageTemplate.data, null, 2));
                }
            }

            console.log(chalk.green(getMessageSuccessMessage(messageTemplateId, output)));
        } catch (e: any) {
            reportError(errorMessage, e);
            process.exit(1);
        }
    });

/**
 * Gets the locales from a message template
 * @param messageTemplate
 */
const getLocalesFromMessageTemplates = (messageTemplate: SMSMessageTemplate): string[] => {
    const locales: string[] = [];
    locales.push(...Object.keys(messageTemplate.localizedTemplates ?? {}));
    return [...new Set<string>(locales)];
}
