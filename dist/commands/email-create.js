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
import { ensureDir, ensureFile } from "fs-extra";
import { v4 } from "uuid";
import chalk from "chalk";
import { logEvent } from "../utils.js";
// noinspection JSUnusedGlobalSymbols
export const emailCreate = new Command('email:create')
    .description('Create an email template in FusionAuth')
    .option('-o, --output <output>', 'The output directory', './emails/')
    .option('-l, --locales <locales...>', 'The locales to create.', [])
    .action((_a) => __awaiter(void 0, [_a], void 0, function* ({ output, locales }) {
    var _b, locales_1, locales_1_1;
    var _c, e_1, _d, _e;
    logEvent('cli command email:create');
    console.log(`Creating email template in ${output}`);
    const emailTemplateId = v4();
    const emailTemplateDirectory = `${output}/${emailTemplateId}/`;
    // Create directory
    yield ensureDir(emailTemplateDirectory);
    // Create files
    yield ensureFile(`${emailTemplateDirectory}/name.txt`);
    yield ensureFile(`${emailTemplateDirectory}/from_email.txt`);
    yield ensureFile(`${emailTemplateDirectory}/body.html`);
    yield ensureFile(`${emailTemplateDirectory}/body.txt`);
    yield ensureFile(`${emailTemplateDirectory}/subject.txt`);
    yield ensureFile(`${emailTemplateDirectory}/from_name.txt`);
    try {
        for (_b = true, locales_1 = __asyncValues(locales); locales_1_1 = yield locales_1.next(), _c = locales_1_1.done, !_c; _b = true) {
            _e = locales_1_1.value;
            _b = false;
            const locale = _e;
            const localeDirectory = `${emailTemplateDirectory}/${locale}`;
            yield ensureFile(`${localeDirectory}/body.html`);
            yield ensureFile(`${localeDirectory}/body.txt`);
            yield ensureFile(`${localeDirectory}/subject.txt`);
            yield ensureFile(`${localeDirectory}/from_name.txt`);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_b && !_c && (_d = locales_1.return)) yield _d.call(locales_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    console.log(chalk.green(`Email template created in ${emailTemplateDirectory}`));
}));
