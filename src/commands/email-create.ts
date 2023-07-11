import {Command} from "commander";
import {ensureDir, ensureFile} from "fs-extra";
import {v4} from "uuid";
import chalk from "chalk";

export const emailCreate = new Command('email:create')
    .description('Create an email template in FusionAuth')
    .option('-o, --output <output>', 'The output directory', './emails/')
    .option('-l, --locales <locales...>', 'The locales to create.',  [])
    .action(async (options) => {
        const {output, locales} = options;

        console.log(`Creating email template in ${output}`);

        const emailTemplateId = v4();
        const emailTemplateDirectory = `${output}/${emailTemplateId}/`;

        // Create directory
        await ensureDir(emailTemplateDirectory);

        // Create files
        await ensureFile(`${emailTemplateDirectory}/name.txt`);
        await ensureFile(`${emailTemplateDirectory}/from_email.txt`);
        await ensureFile(`${emailTemplateDirectory}/body.html`);
        await ensureFile(`${emailTemplateDirectory}/body.txt`);
        await ensureFile(`${emailTemplateDirectory}/subject.txt`);
        await ensureFile(`${emailTemplateDirectory}/from_name.txt`);

        for await (const locale of locales) {
            const localeDirectory = `${emailTemplateDirectory}/${locale}`;
            await ensureFile(`${localeDirectory}/body.html`);
            await ensureFile(`${localeDirectory}/body.txt`);
            await ensureFile(`${localeDirectory}/subject.txt`);
            await ensureFile(`${localeDirectory}/from_name.txt`);
        }

        console.log(chalk.green(`Email template created in ${emailTemplateDirectory}`));
    });
