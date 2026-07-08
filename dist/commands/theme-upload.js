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
import { Command } from '@commander-js/extra-typings';
import { FusionAuthClient } from '@fusionauth/typescript-client';
import chalk from 'chalk';
import { readdir, readFile } from 'fs/promises';
import { errorAndExit, getLocaleFromLocalizedMessageFileName, logEvent } from '../utils.js';
import { apiKeyOption, hostOption, themeTypeOption } from "../options.js";
// noinspection JSUnusedGlobalSymbols
export const themeUpload = new Command('theme:upload')
    .description('Upload a theme to FusionAuth')
    .argument('<themeId>', 'The theme id to upload')
    .option('-i, --input <input>', 'The input directory', './tpl/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .addOption(themeTypeOption)
    .action((themeId_1, _a) => __awaiter(void 0, [themeId_1, _a], void 0, function* (themeId, { input, key: apiKey, host, types }) {
    var _b, e_1, _c, _d, _e, e_2, _f, _g;
    var _h;
    var _j;
    logEvent('cli command theme:upload');
    console.log(`Uploading theme ${themeId} from ${input}`);
    try {
        // Check if theme exists
        const clientResponse = yield new FusionAuthClient(apiKey, host)
            .retrieveTheme(themeId);
        if (!clientResponse.wasSuccessful()) {
            return errorAndExit(`Error uploading theme ${themeId}: `, clientResponse);
        }
        const templates = Object.keys((_j = (_h = clientResponse.response.theme) === null || _h === void 0 ? void 0 : _h.templates) !== null && _j !== void 0 ? _j : {});
        const theme = {};
        const files = yield readdir(input);
        if (types.includes('stylesheet')) {
            theme.stylesheet = yield readFile(`${input}/stylesheet.css`, 'utf-8');
        }
        if (types.includes('messages')) {
            theme.defaultMessages = yield readFile(`${input}/defaultMessages.txt`, 'utf-8');
            try {
                for (var _k = true, files_1 = __asyncValues(files), files_1_1; files_1_1 = yield files_1.next(), _b = files_1_1.done, !_b; _k = true) {
                    _d = files_1_1.value;
                    _k = false;
                    const file = _d;
                    if (!file.startsWith('localizedMessages.'))
                        continue;
                    const locale = getLocaleFromLocalizedMessageFileName(file);
                    if (!locale)
                        continue;
                    theme.localizedMessages = Object.assign(Object.assign({}, theme.localizedMessages), { [locale]: yield readFile(`${input}/${file}`, 'utf-8') });
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_k && !_b && (_c = files_1.return)) yield _c.call(files_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        if (types.includes('templates')) {
            try {
                for (var _l = true, files_2 = __asyncValues(files), files_2_1; files_2_1 = yield files_2.next(), _e = files_2_1.done, !_e; _l = true) {
                    _g = files_2_1.value;
                    _l = false;
                    const file = _g;
                    if (!file.endsWith('.ftl'))
                        continue;
                    const templateName = file.slice(0, -4);
                    if (templates.includes(templateName)) {
                        theme.templates = Object.assign(Object.assign({}, theme.templates), { [templateName]: yield readFile(`${input}/${file}`, 'utf8') });
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_l && !_e && (_f = files_2.return)) yield _f.call(files_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        yield fusionAuthClient.patchTheme(themeId, { theme });
        console.log(chalk.green(`Theme ${themeId} was uploaded successfully`));
    }
    catch (e) {
        errorAndExit(`Error uploading theme ${themeId}: `, e);
    }
}));
