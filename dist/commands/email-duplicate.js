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
import { copy } from "fs-extra";
import { v4 } from "uuid";
import chalk from "chalk";
import { logEvent } from "../utils.js";
// noinspection JSUnusedGlobalSymbols
export const emailDuplicate = new Command('email:duplicate')
    .description('Duplicate an email template')
    .argument('<emailTemplateId>', 'The email template id to duplicate')
    .option('-o, --output <output>', 'The output directory', './emails/')
    .action((emailTemplateId_1, _a) => __awaiter(void 0, [emailTemplateId_1, _a], void 0, function* (emailTemplateId, { output }) {
    logEvent('cli command email:duplicate');
    console.log(`Duplicating email template ${emailTemplateId} in ${output}`);
    const newEmailTemplateId = v4();
    const emailTemplateDirectory = `${output}/${newEmailTemplateId}/`;
    // Copy directory
    yield copy(`${output}/${emailTemplateId}`, emailTemplateDirectory);
    console.log(chalk.green(`Email template created in ${emailTemplateDirectory}`));
}));
