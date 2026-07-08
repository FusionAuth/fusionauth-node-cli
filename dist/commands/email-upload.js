var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { Command } from "@commander-js/extra-typings";
import { getEmailErrorMessage, logEvent, reportError } from "../utils.js";
import { FusionAuthClient } from "@fusionauth/typescript-client";
import { pathExists } from "fs-extra";
import { lstat, readdir, readFile } from "fs/promises";
import { validate as isUUID } from "uuid";
import logUpdate from "log-update";
import chalk from "chalk";
import logSymbols from "log-symbols";
import merge from "merge";
import removeUndefinedObjects from "remove-undefined-objects";
import { apiKeyOption, hostOption } from "../options.js";
const fileNames = ['body.html', 'body.txt', 'subject.txt', 'from_name.txt'];
const properties = ['localizedHtmlTemplates', 'localizedTextTemplates', 'localizedSubjects', 'localizedFromNames'];
// noinspection JSUnusedGlobalSymbols
export const emailUpload = new Command('email:upload')
    .description('Download email templates from FusionAuth')
    .argument('[emailTemplateId]', 'The email template id to upload. If not provided, all email templates will be uploaded')
    .option('-i, --input <input>', 'The input directory', './emails/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .option('-o, --overwrite', 'Overwrite the existing email template with the new one. F.e. locales that are not defined in the directory, but on the FusionAuth server will be removed.', false)
    .option('--no-create', 'Create the email template if it does not exist')
    .action((emailTemplateId_1, _a) => __awaiter(void 0, [emailTemplateId_1, _a], void 0, function* (emailTemplateId, { input, key: apiKey, host, overwrite, create }) {
    var _b, e_1, _c, _d, _e, e_2, _f, _g, _h, e_3, _j, _k;
    logEvent('cli command email:upload');
    const errorMessage = getEmailErrorMessage('uploading', emailTemplateId);
    if (emailTemplateId) {
        console.log(`Uploading email template ${emailTemplateId} from ${input}`);
    }
    else {
        console.log(`Uploading all email templates from ${input}`);
    }
    try {
        const client = new FusionAuthClient(apiKey, host);
        const existingEmailTemplatesIds = yield retrieveExistingEmailTemplatesIds(client);
        const emailTemplateIds = [];
        if (!emailTemplateId) {
            const files = yield readdir(input);
            try {
                for (var _l = true, files_1 = __asyncValues(files), files_1_1; files_1_1 = yield files_1.next(), _b = files_1_1.done, !_b; _l = true) {
                    _d = files_1_1.value;
                    _l = false;
                    const file = _d;
                    // Validate directory
                    if ((yield lstat(`${input}/${file}`)).isDirectory() && isUUID(file)) {
                        emailTemplateIds.push(file);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_l && !_b && (_c = files_1.return)) yield _c.call(files_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        else {
            emailTemplateIds.push(emailTemplateId);
        }
        try {
            for (var _m = true, emailTemplateIds_1 = __asyncValues(emailTemplateIds), emailTemplateIds_1_1; emailTemplateIds_1_1 = yield emailTemplateIds_1.next(), _e = emailTemplateIds_1_1.done, !_e; _m = true) {
                _g = emailTemplateIds_1_1.value;
                _m = false;
                const templateId = _g;
                const templateExists = existingEmailTemplatesIds.includes(templateId);
                if (!create && !templateExists) {
                    reportError(`Email template ${templateId} does not exist on the FusionAuth server. Skipping...`);
                    continue;
                }
                const emailTemplateDirectory = `${input}/${templateId}/`;
                logUpdate(`Uploading email template ${templateId}`);
                const emailTemplate = {};
                // Read the base data
                emailTemplate.name = yield readIfExist(`${emailTemplateDirectory}/name.txt`);
                emailTemplate.fromEmail = yield readIfExist(`${emailTemplateDirectory}/from_email.txt`);
                // Read the default locale
                emailTemplate.defaultHtmlTemplate = yield readIfExist(`${emailTemplateDirectory}/body.html`);
                emailTemplate.defaultTextTemplate = yield readIfExist(`${emailTemplateDirectory}/body.txt`);
                emailTemplate.defaultSubject = yield readIfExist(`${emailTemplateDirectory}/subject.txt`);
                emailTemplate.defaultFromName = yield readIfExist(`${emailTemplateDirectory}/from_name.txt`);
                // Read the locales
                const locales = yield readdir(emailTemplateDirectory);
                try {
                    for (var _o = true, locales_1 = (e_3 = void 0, __asyncValues(locales)), locales_1_1; locales_1_1 = yield locales_1.next(), _h = locales_1_1.done, !_h; _o = true) {
                        _k = locales_1_1.value;
                        _o = false;
                        const locale = _k;
                        const localeDirectory = `${emailTemplateDirectory}/${locale}`;
                        const stats = yield lstat(localeDirectory);
                        if (stats.isDirectory()) {
                            for (let i = 0; i < fileNames.length; i++) {
                                const fileContent = yield readIfExist(localeDirectory + '/' + fileNames[i]);
                                if (fileContent) {
                                    merge.recursive(emailTemplate, { [properties[i]]: { [locale]: fileContent } });
                                }
                            }
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (!_o && !_h && (_j = locales_1.return)) yield _j.call(locales_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                try {
                    const request = { emailTemplate: removeUndefinedObjects(emailTemplate) };
                    if (!templateExists) {
                        yield client.createEmailTemplate(templateId, request);
                    }
                    else if (overwrite) {
                        yield client.updateEmailTemplate(templateId, request);
                    }
                    else {
                        yield client.patchEmailTemplate(templateId, request);
                    }
                    logUpdate(`Uploading email template ${templateId} - ` + chalk.green(`${logSymbols.success} Success`));
                    logUpdate.done();
                }
                catch (e) {
                    logUpdate(`Uploading email template ${templateId} - ` + chalk.red(`${logSymbols.error} Failed`));
                    logUpdate.done();
                    reportError(`Error uploading email template ${templateId}: `, e);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (!_m && !_e && (_f = emailTemplateIds_1.return)) yield _f.call(emailTemplateIds_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    catch (e) {
        reportError(errorMessage, e);
        process.exit(1);
    }
}));
/**
 * Read a file if it exists and has content, otherwise return undefined
 * @param path
 */
const readIfExist = (path) => __awaiter(void 0, void 0, void 0, function* () {
    if (yield pathExists(path)) {
        const content = yield readFile(path, 'utf-8');
        if (content) {
            return content;
        }
    }
    return undefined;
});
/**
 * Retrieve all existing email templates
 * @param client FusionAuth client
 */
const retrieveExistingEmailTemplatesIds = (client) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    var _b;
    const existingEmailTemplate = yield client.retrieveEmailTemplates();
    return (_b = (_a = existingEmailTemplate.response.emailTemplates) === null || _a === void 0 ? void 0 : _a.map(template => template.id)) !== null && _b !== void 0 ? _b : [];
});
