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
import { getMessageErrorMessage, logEvent, reportError } from "../utils.js";
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
// noinspection JSUnusedGlobalSymbols
export const messageUpload = new Command('message:upload')
    .description('Upload message templates to FusionAuth')
    .argument('[messageTemplateId]', 'The message template id to upload. If not provided, all message templates will be uploaded')
    .option('-i, --input <input>', 'The input directory', './messages/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .option('-o, --overwrite', 'Overwrite the existing message template with the new one. F.e. locales that are not defined in the directory, but on the FusionAuth server will be removed.', false)
    .option('--no-create', 'Create the message template if it does not exist')
    .action((messageTemplateId_1, _a) => __awaiter(void 0, [messageTemplateId_1, _a], void 0, function* (messageTemplateId, { input, key: apiKey, host, overwrite, create }) {
    var _b, e_1, _c, _d, _e, e_2, _f, _g, _h, e_3, _j, _k;
    logEvent('cli command message:upload');
    const errorMessage = getMessageErrorMessage('uploading', messageTemplateId);
    if (messageTemplateId) {
        console.log(`Uploading message template ${messageTemplateId} from ${input}`);
    }
    else {
        console.log(`Uploading all message templates from ${input}`);
    }
    try {
        const client = new FusionAuthClient(apiKey, host);
        const existingMessageTemplatesIds = yield retrieveExistingMessageTemplatesIds(client);
        const messageTemplateIds = [];
        if (!messageTemplateId) {
            const files = yield readdir(input);
            try {
                for (var _l = true, files_1 = __asyncValues(files), files_1_1; files_1_1 = yield files_1.next(), _b = files_1_1.done, !_b; _l = true) {
                    _d = files_1_1.value;
                    _l = false;
                    const file = _d;
                    // Validate directory
                    if ((yield lstat(`${input}/${file}`)).isDirectory() && isUUID(file)) {
                        messageTemplateIds.push(file);
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
            messageTemplateIds.push(messageTemplateId);
        }
        try {
            for (var _m = true, messageTemplateIds_1 = __asyncValues(messageTemplateIds), messageTemplateIds_1_1; messageTemplateIds_1_1 = yield messageTemplateIds_1.next(), _e = messageTemplateIds_1_1.done, !_e; _m = true) {
                _g = messageTemplateIds_1_1.value;
                _m = false;
                const templateId = _g;
                const templateExists = existingMessageTemplatesIds.includes(templateId);
                if (!create && !templateExists) {
                    reportError(`Message template ${templateId} does not exist on the FusionAuth server. Skipping...`);
                    continue;
                }
                const messageTemplateDirectory = `${input}/${templateId}/`;
                logUpdate(`Uploading message template ${templateId}`);
                const messageTemplate = {};
                // Read the base data
                messageTemplate.name = yield readIfExist(`${messageTemplateDirectory}/name.txt`);
                messageTemplate.type = yield readIfExist(`${messageTemplateDirectory}/type.txt`);
                // Read the default template
                messageTemplate.defaultTemplate = yield readIfExist(`${messageTemplateDirectory}/template.txt`);
                // Read additional data from JSON if it exists
                const dataContent = yield readIfExist(`${messageTemplateDirectory}/data.json`);
                if (dataContent) {
                    try {
                        messageTemplate.data = JSON.parse(dataContent);
                    }
                    catch (e) {
                        reportError(`Invalid JSON in data.json for template ${templateId}`, e);
                    }
                }
                // Read the localized templates
                const locales = yield readdir(messageTemplateDirectory);
                try {
                    for (var _o = true, locales_1 = (e_3 = void 0, __asyncValues(locales)), locales_1_1; locales_1_1 = yield locales_1.next(), _h = locales_1_1.done, !_h; _o = true) {
                        _k = locales_1_1.value;
                        _o = false;
                        const locale = _k;
                        const localeDirectory = `${messageTemplateDirectory}/${locale}`;
                        const stats = yield lstat(localeDirectory).catch(() => null);
                        if (stats === null || stats === void 0 ? void 0 : stats.isDirectory()) {
                            const localizedTemplate = yield readIfExist(`${localeDirectory}/template.txt`);
                            if (localizedTemplate) {
                                merge.recursive(messageTemplate, { localizedTemplates: { [locale]: localizedTemplate } });
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
                    const request = { messageTemplate: removeUndefinedObjects(messageTemplate) };
                    if (!templateExists) {
                        yield client.createMessageTemplate(templateId, request);
                    }
                    else if (overwrite) {
                        yield client.updateMessageTemplate(templateId, request);
                    }
                    else {
                        yield client.patchMessageTemplate(templateId, request);
                    }
                    logUpdate(`Uploading message template ${templateId} - ` + chalk.green(`${logSymbols.success} Success`));
                    logUpdate.done();
                }
                catch (e) {
                    logUpdate(`Uploading message template ${templateId} - ` + chalk.red(`${logSymbols.error} Failed`));
                    logUpdate.done();
                    reportError(`Error uploading message template ${templateId}: `, e);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (!_m && !_e && (_f = messageTemplateIds_1.return)) yield _f.call(messageTemplateIds_1);
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
 * Retrieve all existing message templates
 * @param client FusionAuth client
 */
const retrieveExistingMessageTemplatesIds = (client) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    var _b;
    const existingMessageTemplates = yield client.retrieveMessageTemplates();
    return (_b = (_a = existingMessageTemplates.response.messageTemplates) === null || _a === void 0 ? void 0 : _a.map(template => template.id)) !== null && _b !== void 0 ? _b : [];
});
