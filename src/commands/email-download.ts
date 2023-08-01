import {Command} from "@commander-js/extra-typings";
import {getEmailErrorMessage, getEmailSuccessMessage, reportError} from "../utils.js";
import {EmailTemplate, FusionAuthClient} from "@fusionauth/typescript-client";
import {mkdir, writeFile} from "fs/promises";
import chalk from "chalk";
import {emptyDir, pathExists} from "fs-extra";
import {apiKeyOption, hostOption} from "../options.js";
import {existsSync} from "fs";

// noinspection JSUnusedGlobalSymbols
export const emailDownload = new Command('email:download')
    .description('Download email templates from FusionAuth')
    .argument('[emailTemplateId]', 'The email template id to download. If not provided, all email templates will be downloaded')
    .option('-o, --output <output>', 'The output directory', './emails/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .option('-c, --clean', 'Clean the output directory before downloading', false)
    .action(async (emailTemplateId, {output, key: apiKey, host, clean}) => {

        let clientResponse;
        const errorMessage = getEmailErrorMessage('download', emailTemplateId);

        if (emailTemplateId) {
            console.log(`Downloading email template ${emailTemplateId} to ${output}`);
        } else {
            console.log(`Downloading all email templates to ${output}`);
        }

        try {
            if (clean) {
                const cleanDirectory = emailTemplateId ? `${output}/${emailTemplateId}` : output;
                if (await pathExists(cleanDirectory)) {
                    console.log(`Cleaning ${cleanDirectory}`);
                    await emptyDir(cleanDirectory);
                }
            }

            const client = new FusionAuthClient(apiKey, host);

            if (emailTemplateId) {
                clientResponse = await client.retrieveEmailTemplate(emailTemplateId);
            } else {
                clientResponse = await client.retrieveEmailTemplates();
            }

            if (!clientResponse.wasSuccessful()) {
                reportError(errorMessage, clientResponse);
                process.exit(1);
            }

            let emailTemplates: EmailTemplate[];
            if (emailTemplateId && clientResponse.response.emailTemplate) {
                emailTemplates = [clientResponse.response.emailTemplate];
            } else {
                emailTemplates = clientResponse.response.emailTemplates ?? []
            }

            for await (const emailTemplate of emailTemplates) {
                const emailTemplateId = emailTemplate.id;
                const emailTemplateDirectory = `${output}/${emailTemplateId}/`;

                if (!existsSync(emailTemplateDirectory)) {
                    await mkdir(emailTemplateDirectory, {recursive: true});
                }

                await writeFile(`${emailTemplateDirectory}/name.txt`, emailTemplate.name ?? '');
                await writeFile(`${emailTemplateDirectory}/from_email.txt`, emailTemplate.fromEmail ?? '');

                // Export the default email template
                await writeFile(`${emailTemplateDirectory}/body.html`, emailTemplate.defaultHtmlTemplate ?? '');
                await writeFile(`${emailTemplateDirectory}/body.txt`, emailTemplate.defaultTextTemplate ?? '');
                await writeFile(`${emailTemplateDirectory}/subject.txt`, emailTemplate.defaultSubject ?? '');
                await writeFile(`${emailTemplateDirectory}/from_name.txt`, emailTemplate.defaultFromName ?? '');

                // Export localized email templates
                const locales = getLocalesFromEmailTemplates(emailTemplate);
                for (const locale of locales) {
                    const localeDirectory = `${emailTemplateDirectory}/${locale}/`;
                    if (!existsSync(localeDirectory)) {
                        await mkdir(localeDirectory);
                    }

                    await writeFile(`${localeDirectory}/body.html`, emailTemplate.localizedHtmlTemplates?.[locale] ?? '');
                    await writeFile(`${localeDirectory}/body.txt`, emailTemplate.localizedTextTemplates?.[locale] ?? '');
                    await writeFile(`${localeDirectory}/subject.txt`, emailTemplate.localizedSubjects?.[locale] ?? '');
                    await writeFile(`${localeDirectory}/from_name.txt`, emailTemplate.localizedFromNames?.[locale] ?? '');
                }
            }

            console.log(chalk.green(getEmailSuccessMessage(emailTemplateId, output)));
        } catch (e: any) {
            reportError(errorMessage, e);
            process.exit(1);
        }
    });

/**
 * Gets the locales from a list of email templates
 * @param emailTemplate
 */
export const getLocalesFromEmailTemplates = (emailTemplate: EmailTemplate): string[] => {
    const locales: string[] = [];
    locales.push(...Object.keys(emailTemplate.localizedFromNames ?? {}));
    locales.push(...Object.keys(emailTemplate.localizedSubjects ?? {}));
    locales.push(...Object.keys(emailTemplate.localizedTextTemplates ?? {}));
    locales.push(...Object.keys(emailTemplate.localizedHtmlTemplates ?? {}));
    return [...new Set<string>(locales)];
}
