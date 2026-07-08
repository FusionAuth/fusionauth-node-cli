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
import { validate as isUUID } from "uuid";
import chalk from "chalk";
import { lstat, readdir, readFile, writeFile } from "fs/promises";
import { compile } from "html-to-text";
import { logEvent } from "../utils.js";
const htmlToText = compile({
    wordwrap: false,
    selectors: [
        { selector: 'p', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
    ]
});
// noinspection JSUnusedGlobalSymbols
export const emailHtmlToText = new Command('email:html-to-text')
    .description('Find missing text templates and create them from the html templates')
    .argument('[emailTemplateId]', 'The email template id to convert. If not provided, all email templates will be converted')
    .option('-o, --output <output>', 'The output directory', './emails/')
    .action((emailTemplateId_1, _a) => __awaiter(void 0, [emailTemplateId_1, _a], void 0, function* (emailTemplateId, { output }) {
    var _b, e_1, _c, _d, _e, e_2, _f, _g, _h, e_3, _j, _k;
    logEvent('cli command email:html-to-text');
    if (!emailTemplateId) {
        console.log(`Converting all email templates in ${output}`);
    }
    else {
        console.log(`Converting email template ${emailTemplateId} in ${output}`);
    }
    const emailTemplateIds = [];
    if (!emailTemplateId) {
        const files = yield readdir(output);
        try {
            for (var _l = true, files_1 = __asyncValues(files), files_1_1; files_1_1 = yield files_1.next(), _b = files_1_1.done, !_b; _l = true) {
                _d = files_1_1.value;
                _l = false;
                const file = _d;
                // Validate directory
                if ((yield lstat(`${output}/${file}`)).isDirectory() && isUUID(file)) {
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
    try {
        for (var _m = true, emailTemplateIds_1 = __asyncValues(emailTemplateIds), emailTemplateIds_1_1; emailTemplateIds_1_1 = yield emailTemplateIds_1.next(), _e = emailTemplateIds_1_1.done, !_e; _m = true) {
            _g = emailTemplateIds_1_1.value;
            _m = false;
            const templateId = _g;
            const emailTemplateDirectory = `${output}/${templateId}/`;
            console.log(`Converting email template ${templateId}`);
            // Check default locale
            const htmlContent = yield readFile(`${emailTemplateDirectory}/body.html`, 'utf-8');
            const textContent = yield readFile(`${emailTemplateDirectory}/body.txt`, 'utf-8');
            if (htmlContent.length && !textContent.length) {
                console.log(`Creating text template for ${templateId}`);
                yield writeFile(`${emailTemplateDirectory}/body.txt`, htmlToText(htmlContent));
            }
            // Check locales
            const locales = yield readdir(emailTemplateDirectory);
            try {
                for (var _o = true, locales_1 = (e_3 = void 0, __asyncValues(locales)), locales_1_1; locales_1_1 = yield locales_1.next(), _h = locales_1_1.done, !_h; _o = true) {
                    _k = locales_1_1.value;
                    _o = false;
                    const locale = _k;
                    // Validate directory
                    const localeDirectory = `${emailTemplateDirectory}/${locale}`;
                    if ((yield lstat(`${emailTemplateDirectory}/${locale}`)).isDirectory()) {
                        const localizedHtmlContent = yield readFile(`${localeDirectory}/body.html`, 'utf-8');
                        const localizedTextContent = yield readFile(`${localeDirectory}/body.txt`, 'utf-8');
                        if (localizedHtmlContent.length && !localizedTextContent.length) {
                            console.log(`Creating text template for ${templateId} in ${locale}`);
                            yield writeFile(`${localeDirectory}/body.txt`, htmlToText(localizedHtmlContent));
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
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (!_m && !_e && (_f = emailTemplateIds_1.return)) yield _f.call(emailTemplateIds_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    console.log(chalk.green(`Finished converting email template(s)`));
}));
