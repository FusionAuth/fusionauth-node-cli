import {Command} from "@commander-js/extra-typings";
import {validate as isUUID} from "uuid";
import chalk from "chalk";
import {lstat, readdir, readFile, writeFile} from "fs/promises";
import {compile} from "html-to-text";

const htmlToText = compile({
    wordwrap: false,
    selectors: [
        {selector: 'p', options: {leadingLineBreaks: 1, trailingLineBreaks: 1}},
    ]
})

// noinspection JSUnusedGlobalSymbols
export const emailHtmlToText = new Command('email:html-to-text')
    .description('Find missing text templates and create them from the html templates')
    .argument('[emailTemplateId]', 'The email template id to convert. If not provided, all email templates will be converted')
    .option('-o, --output <output>', 'The output directory', './emails/')
    .action(async (emailTemplateId: string | undefined, {output}) => {
        if (!emailTemplateId) {
            console.log(`Converting all email templates in ${output}`);
        } else {
            console.log(`Converting email template ${emailTemplateId} in ${output}`);
        }

        const emailTemplateIds = [];
        if (!emailTemplateId) {
            const files = await readdir(output);
            for await (const file of files) {
                // Validate directory
                if ((await lstat(`${output}/${file}`)).isDirectory() && isUUID(file)) {
                    emailTemplateIds.push(file);
                }
            }
        }

        for await (const templateId of emailTemplateIds) {
            const emailTemplateDirectory = `${output}/${templateId}/`;

            console.log(`Converting email template ${templateId}`);

            // Check default locale
            const htmlContent = await readFile(`${emailTemplateDirectory}/body.html`, 'utf-8');
            const textContent = await readFile(`${emailTemplateDirectory}/body.txt`, 'utf-8');

            if (htmlContent.length && !textContent.length) {
                console.log(`Creating text template for ${templateId}`);
                await writeFile(`${emailTemplateDirectory}/body.txt`, htmlToText(htmlContent));
            }

            // Check locales
            const locales = await readdir(emailTemplateDirectory);
            for await (const locale of locales) {
                // Validate directory
                const localeDirectory = `${emailTemplateDirectory}/${locale}`;
                if ((await lstat(`${emailTemplateDirectory}/${locale}`)).isDirectory()) {
                    const localizedHtmlContent = await readFile(`${localeDirectory}/body.html`, 'utf-8');
                    const localizedTextContent = await readFile(`${localeDirectory}/body.txt`, 'utf-8');

                    if (localizedHtmlContent.length && !localizedTextContent.length) {
                        console.log(`Creating text template for ${templateId} in ${locale}`);
                        await writeFile(`${localeDirectory}/body.txt`, htmlToText(localizedHtmlContent));
                    }
                }
            }

        }

        console.log(chalk.green(`Finished converting email template(s)`));
    });
