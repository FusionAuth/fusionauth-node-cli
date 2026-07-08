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
import { getEmailErrorMessage, getEmailSuccessMessage, logEvent, reportError } from "../utils.js";
import { FusionAuthClient } from "@fusionauth/typescript-client";
import { mkdir, writeFile } from "fs/promises";
import chalk from "chalk";
import { emptyDir, pathExists } from "fs-extra";
import { apiKeyOption, hostOption } from "../options.js";
import { existsSync } from "fs";
// noinspection JSUnusedGlobalSymbols
export const emailDownload = new Command('email:download')
    .description('Download email templates from FusionAuth')
    .argument('[emailTemplateId]', 'The email template id to download. If not provided, all email templates will be downloaded')
    .option('-o, --output <output>', 'The output directory', './emails/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .option('-c, --clean', 'Clean the output directory before downloading', false)
    .action((emailTemplateId_1, _a) => __awaiter(void 0, [emailTemplateId_1, _a], void 0, function* (emailTemplateId, { output, key: apiKey, host, clean }) {
    var _b, e_1, _c, _d;
    var _e, _f, _g, _h;
    var _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    logEvent('cli command email:download');
    let clientResponse;
    const errorMessage = getEmailErrorMessage('download', emailTemplateId);
    if (emailTemplateId) {
        console.log(`Downloading email template ${emailTemplateId} to ${output}`);
    }
    else {
        console.log(`Downloading all email templates to ${output}`);
    }
    try {
        if (clean) {
            const cleanDirectory = emailTemplateId ? `${output}/${emailTemplateId}` : output;
            if (yield pathExists(cleanDirectory)) {
                console.log(`Cleaning ${cleanDirectory}`);
                yield emptyDir(cleanDirectory);
            }
        }
        const client = new FusionAuthClient(apiKey, host);
        if (emailTemplateId) {
            clientResponse = yield client.retrieveEmailTemplate(emailTemplateId);
        }
        else {
            clientResponse = yield client.retrieveEmailTemplates();
        }
        if (!clientResponse.wasSuccessful()) {
            reportError(errorMessage, clientResponse);
            process.exit(1);
        }
        let emailTemplates;
        if (emailTemplateId && clientResponse.response.emailTemplate) {
            emailTemplates = [clientResponse.response.emailTemplate];
        }
        else {
            emailTemplates = (_j = clientResponse.response.emailTemplates) !== null && _j !== void 0 ? _j : [];
        }
        try {
            for (var _v = true, emailTemplates_1 = __asyncValues(emailTemplates), emailTemplates_1_1; emailTemplates_1_1 = yield emailTemplates_1.next(), _b = emailTemplates_1_1.done, !_b; _v = true) {
                _d = emailTemplates_1_1.value;
                _v = false;
                const emailTemplate = _d;
                const emailTemplateId = emailTemplate.id;
                const emailTemplateDirectory = `${output}/${emailTemplateId}/`;
                if (!existsSync(emailTemplateDirectory)) {
                    yield mkdir(emailTemplateDirectory, { recursive: true });
                }
                yield writeFile(`${emailTemplateDirectory}/name.txt`, (_k = emailTemplate.name) !== null && _k !== void 0 ? _k : '');
                yield writeFile(`${emailTemplateDirectory}/from_email.txt`, (_l = emailTemplate.fromEmail) !== null && _l !== void 0 ? _l : '');
                // Export the default email template
                yield writeFile(`${emailTemplateDirectory}/body.html`, (_m = emailTemplate.defaultHtmlTemplate) !== null && _m !== void 0 ? _m : '');
                yield writeFile(`${emailTemplateDirectory}/body.txt`, (_o = emailTemplate.defaultTextTemplate) !== null && _o !== void 0 ? _o : '');
                yield writeFile(`${emailTemplateDirectory}/subject.txt`, (_p = emailTemplate.defaultSubject) !== null && _p !== void 0 ? _p : '');
                yield writeFile(`${emailTemplateDirectory}/from_name.txt`, (_q = emailTemplate.defaultFromName) !== null && _q !== void 0 ? _q : '');
                // Export localized email templates
                const locales = getLocalesFromEmailTemplates(emailTemplate);
                for (const locale of locales) {
                    const localeDirectory = `${emailTemplateDirectory}/${locale}/`;
                    if (!existsSync(localeDirectory)) {
                        yield mkdir(localeDirectory);
                    }
                    yield writeFile(`${localeDirectory}/body.html`, (_r = (_e = emailTemplate.localizedHtmlTemplates) === null || _e === void 0 ? void 0 : _e[locale]) !== null && _r !== void 0 ? _r : '');
                    yield writeFile(`${localeDirectory}/body.txt`, (_s = (_f = emailTemplate.localizedTextTemplates) === null || _f === void 0 ? void 0 : _f[locale]) !== null && _s !== void 0 ? _s : '');
                    yield writeFile(`${localeDirectory}/subject.txt`, (_t = (_g = emailTemplate.localizedSubjects) === null || _g === void 0 ? void 0 : _g[locale]) !== null && _t !== void 0 ? _t : '');
                    yield writeFile(`${localeDirectory}/from_name.txt`, (_u = (_h = emailTemplate.localizedFromNames) === null || _h === void 0 ? void 0 : _h[locale]) !== null && _u !== void 0 ? _u : '');
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_v && !_b && (_c = emailTemplates_1.return)) yield _c.call(emailTemplates_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        console.log(chalk.green(getEmailSuccessMessage(emailTemplateId, output)));
    }
    catch (e) {
        reportError(errorMessage, e);
        process.exit(1);
    }
}));
/**
 * Gets the locales from a list of email templates
 * @param emailTemplate
 */
const getLocalesFromEmailTemplates = (emailTemplate) => {
    var _a, _b, _c, _d;
    const locales = [];
    locales.push(...Object.keys((_a = emailTemplate.localizedFromNames) !== null && _a !== void 0 ? _a : {}));
    locales.push(...Object.keys((_b = emailTemplate.localizedSubjects) !== null && _b !== void 0 ? _b : {}));
    locales.push(...Object.keys((_c = emailTemplate.localizedTextTemplates) !== null && _c !== void 0 ? _c : {}));
    locales.push(...Object.keys((_d = emailTemplate.localizedHtmlTemplates) !== null && _d !== void 0 ? _d : {}));
    return [...new Set(locales)];
};
