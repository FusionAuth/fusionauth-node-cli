var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Command } from "@commander-js/extra-typings";
import { logEvent, reportError } from "../utils.js";
import { watch } from "chokidar";
import Queue from "queue";
import logUpdate from "log-update";
import { FusionAuthClient } from "@fusionauth/typescript-client";
import { readFile, realpath } from "fs/promises";
import chalk from "chalk";
import { sep as pathSeparator } from "path";
import logSymbols from "log-symbols";
import { apiKeyOption, hostOption } from "../options.js";
// To prevent multiple uploads from happening at once, we use a queue
const q = new Queue({ autostart: true, concurrency: 1 });
// noinspection JSUnusedGlobalSymbols
export const emailWatch = new Command('email:watch')
    .description('Watch email templates for changes and upload to FusionAuth')
    .option('-i, --input <input>', 'The input directory', './emails/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action((_a) => __awaiter(void 0, [_a], void 0, function* ({ input, key: apiKey, host }) {
    logEvent('cli command email:watch');
    console.log(`Watching email templates in ${input}`);
    const watchedFiles = [
        `${input}/**/*.html`,
        `${input}/**/*.txt`,
    ];
    const absoluteInput = yield realpath(input);
    watch(watchedFiles, {
        ignoreInitial: true,
    })
        .on('all', (event, path) => {
        q.push(() => __awaiter(void 0, void 0, void 0, function* () {
            logUpdate(`Uploading ${path}`);
            const content = yield readFile(path, 'utf-8');
            const absolutePath = yield realpath(path);
            const relativePath = absolutePath.substring(absoluteInput.length + 1);
            const parts = relativePath.split(pathSeparator);
            let emailTemplateId, locale, fileName;
            if (parts.length === 2) {
                emailTemplateId = parts[0];
                fileName = parts[1];
            }
            else if (parts.length === 3) {
                emailTemplateId = parts[0];
                locale = parts[1];
                fileName = parts[2];
            }
            else {
                reportError(`Invalid path ${path}`);
                return;
            }
            const emailTemplate = prepareEmailTemplate(fileName, content, locale);
            if (!emailTemplate) {
                logUpdate(`Uploading ${path} - ` + chalk.yellow(`${logSymbols.warning} Unknown file`));
                logUpdate.done();
                return;
            }
            try {
                const fusionAuthClient = new FusionAuthClient(apiKey, host);
                yield fusionAuthClient.patchEmailTemplate(emailTemplateId, { emailTemplate });
                logUpdate(`Uploading ${path} - ` + chalk.green(`${logSymbols.success} Success`));
                logUpdate.done();
            }
            catch (e) {
                logUpdate(`Uploading ${path} - ` + chalk.red(`${logSymbols.error} Failed`));
                logUpdate.done();
                reportError(`Error uploading email template ${emailTemplateId}: `, e);
            }
        }));
    });
}));
const fieldPropertyMap = {
    'body.html': ['defaultHtmlTemplate', 'localizedHtmlTemplates'],
    'body.txt': ['defaultTextTemplate', 'localizedTextTemplates'],
    'subject.txt': ['defaultSubject', 'localizedSubjects'],
    'from_name.txt': ['defaultFromName', 'localizedFromNames'],
    'from_email.txt': ['fromEmail'],
    'name.txt': ['name'],
};
/**
 * Prepare an email template object based on the file name and locale
 * @param fileName The file name, e.g., body.html
 * @param content The content of the file
 * @param locale The locale of the file, if any
 */
const prepareEmailTemplate = (fileName, content, locale) => {
    if (fieldPropertyMap[fileName] === undefined) {
        return;
    }
    const emailTemplate = {};
    const [defaultProp, localeSpecificProp] = fieldPropertyMap[fileName];
    if (localeSpecificProp && locale) {
        emailTemplate[localeSpecificProp] = { [locale]: content };
    }
    else {
        emailTemplate[defaultProp] = content;
    }
    return emailTemplate;
};
