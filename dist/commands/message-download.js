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
import { getMessageErrorMessage, getMessageSuccessMessage, logEvent, reportError } from "../utils.js";
import { FusionAuthClient } from "@fusionauth/typescript-client";
import { mkdir, writeFile } from "fs/promises";
import chalk from "chalk";
import { emptyDir, pathExists } from "fs-extra";
import { apiKeyOption, hostOption } from "../options.js";
import { existsSync } from "fs";
// noinspection JSUnusedGlobalSymbols
export const messageDownload = new Command('message:download')
    .description('Download message templates from FusionAuth')
    .argument('[messageTemplateId]', 'The message template id to download. If not provided, all message templates will be downloaded')
    .option('-o, --output <output>', 'The output directory', './messages/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .option('-c, --clean', 'Clean the output directory before downloading', false)
    .action((messageTemplateId_1, _a) => __awaiter(void 0, [messageTemplateId_1, _a], void 0, function* (messageTemplateId, { output, key: apiKey, host, clean }) {
    var _b, e_1, _c, _d;
    var _e;
    var _f, _g, _h, _j, _k;
    logEvent('cli command message:download');
    let clientResponse;
    const errorMessage = getMessageErrorMessage('download', messageTemplateId);
    if (messageTemplateId) {
        console.log(`Downloading message template ${messageTemplateId} to ${output}`);
    }
    else {
        console.log(`Downloading all message templates to ${output}`);
    }
    try {
        if (clean) {
            const cleanDirectory = messageTemplateId ? `${output}/${messageTemplateId}` : output;
            if (yield pathExists(cleanDirectory)) {
                console.log(`Cleaning ${cleanDirectory}`);
                yield emptyDir(cleanDirectory);
            }
        }
        const client = new FusionAuthClient(apiKey, host);
        if (messageTemplateId) {
            clientResponse = yield client.retrieveMessageTemplate(messageTemplateId);
        }
        else {
            clientResponse = yield client.retrieveMessageTemplates();
        }
        if (!clientResponse.wasSuccessful()) {
            reportError(errorMessage, clientResponse);
            process.exit(1);
        }
        let messageTemplates;
        if (messageTemplateId && clientResponse.response.messageTemplate) {
            messageTemplates = [clientResponse.response.messageTemplate];
        }
        else {
            messageTemplates = (_f = clientResponse.response.messageTemplates) !== null && _f !== void 0 ? _f : [];
        }
        try {
            for (var _l = true, messageTemplates_1 = __asyncValues(messageTemplates), messageTemplates_1_1; messageTemplates_1_1 = yield messageTemplates_1.next(), _b = messageTemplates_1_1.done, !_b; _l = true) {
                _d = messageTemplates_1_1.value;
                _l = false;
                const messageTemplate = _d;
                const messageTemplateId = messageTemplate.id;
                const messageTemplateDirectory = `${output}/${messageTemplateId}/`;
                if (!existsSync(messageTemplateDirectory)) {
                    yield mkdir(messageTemplateDirectory, { recursive: true });
                }
                yield writeFile(`${messageTemplateDirectory}/name.txt`, (_g = messageTemplate.name) !== null && _g !== void 0 ? _g : '');
                yield writeFile(`${messageTemplateDirectory}/type.txt`, (_h = messageTemplate.type) !== null && _h !== void 0 ? _h : '');
                // Export the default message template (only for SMS templates)
                const smsTemplate = messageTemplate;
                yield writeFile(`${messageTemplateDirectory}/template.txt`, (_j = smsTemplate.defaultTemplate) !== null && _j !== void 0 ? _j : '');
                // Export localized message templates
                const locales = getLocalesFromMessageTemplates(smsTemplate);
                for (const locale of locales) {
                    const localeDirectory = `${messageTemplateDirectory}/${locale}/`;
                    if (!existsSync(localeDirectory)) {
                        yield mkdir(localeDirectory);
                    }
                    yield writeFile(`${localeDirectory}/template.txt`, (_k = (_e = smsTemplate.localizedTemplates) === null || _e === void 0 ? void 0 : _e[locale]) !== null && _k !== void 0 ? _k : '');
                }
                // Export additional data as JSON if it exists
                if (messageTemplate.data && Object.keys(messageTemplate.data).length > 0) {
                    yield writeFile(`${messageTemplateDirectory}/data.json`, JSON.stringify(messageTemplate.data, null, 2));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_l && !_b && (_c = messageTemplates_1.return)) yield _c.call(messageTemplates_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        console.log(chalk.green(getMessageSuccessMessage(messageTemplateId, output)));
    }
    catch (e) {
        reportError(errorMessage, e);
        process.exit(1);
    }
}));
/**
 * Gets the locales from a message template
 * @param messageTemplate
 */
const getLocalesFromMessageTemplates = (messageTemplate) => {
    var _a;
    const locales = [];
    locales.push(...Object.keys((_a = messageTemplate.localizedTemplates) !== null && _a !== void 0 ? _a : {}));
    return [...new Set(locales)];
};
