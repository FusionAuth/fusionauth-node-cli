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
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { errorAndExit, logEvent, toString } from '../utils.js';
import { apiKeyOption, hostOption, themeTypeOption } from "../options.js";
// noinspection JSUnusedGlobalSymbols
export const themeDownload = new Command('theme:download')
    .description('Download a theme from FusionAuth')
    .argument('<themeId>', 'The theme id to download')
    .option('-o, --output <output>', 'The output directory', './tpl/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .addOption(themeTypeOption)
    .action((themeId_1, _a) => __awaiter(void 0, [themeId_1, _a], void 0, function* (themeId, { output, key: apiKey, host, types }) {
    var _b, e_1, _c, _d, _e, e_2, _f, _g;
    logEvent('cli command theme:download');
    console.log(`Downloading theme ${themeId} to ${output}`);
    try {
        const theme = yield new FusionAuthClient(apiKey, host)
            .retrieveTheme(themeId);
        if (!theme.wasSuccessful()) {
            return errorAndExit(`Error downloading theme ${themeId}: `, theme);
        }
        if (!theme.response.theme) {
            return errorAndExit(`Error downloading theme ${themeId}: `, 'Theme not found');
        }
        const { templates, stylesheet, defaultMessages, localizedMessages } = theme.response.theme;
        if (!existsSync(output)) {
            yield mkdir(output);
        }
        if (types.includes('stylesheet')) {
            yield writeFile(`${output}/stylesheet.css`, toString(stylesheet));
        }
        if (types.includes('messages')) {
            yield writeFile(`${output}/defaultMessages.txt`, toString(defaultMessages));
            try {
                for (var _h = true, _j = __asyncValues(Object.entries(localizedMessages !== null && localizedMessages !== void 0 ? localizedMessages : {})), _k; _k = yield _j.next(), _b = _k.done, !_b; _h = true) {
                    _d = _k.value;
                    _h = false;
                    const [locale, messages] = _d;
                    yield writeFile(`${output}/localizedMessages.${locale}.txt`, messages !== null && messages !== void 0 ? messages : '');
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_h && !_b && (_c = _j.return)) yield _c.call(_j);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        if (types.includes('templates')) {
            try {
                for (var _l = true, _m = __asyncValues(Object.entries(templates !== null && templates !== void 0 ? templates : {})), _o; _o = yield _m.next(), _e = _o.done, !_e; _l = true) {
                    _g = _o.value;
                    _l = false;
                    const [name, template] = _g;
                    yield writeFile(`${output}/${name}.ftl`, template);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_l && !_e && (_f = _m.return)) yield _f.call(_m);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        console.log(chalk.green(`Theme ${themeId} downloaded to ${output}`));
    }
    catch (e) {
        errorAndExit(`Error downloading theme ${themeId}: `, e);
    }
}));
