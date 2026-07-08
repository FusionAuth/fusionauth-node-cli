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
import chalk from "chalk";
import { spawn } from 'node:child_process';
import { betaWarning, isDockerInstalled, logEvent } from "../utils.js";
import boxen from "boxen";
import inquirer from "inquirer";
const action = function () {
    return __awaiter(this, void 0, void 0, function* () {
        betaWarning();
        try {
            if (!isDockerInstalled())
                throw (chalk.red('Error: You need Docker to run.'));
            if (process.cwd() != process.env.CLI_DIR)
                throw (chalk.red('Error: Current directory was not kickstarted.'));
            logEvent('cli command kickstart:kill');
            inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmation',
                    message: 'This is a destructive action. Are you sure you want to kill this container?'
                }
            ])
                .then((answers) => __awaiter(this, void 0, void 0, function* () {
                var _a, e_1, _b, _c;
                if (!answers.confirmation) {
                    console.log(chalk.yellow('Cancelling the shutdown. The container is still running'));
                    process.exit();
                }
                console.log(chalk.yellow('Killing FusionAuth...\n'));
                try {
                    const starting = spawn('docker compose down -v', { shell: true, stdio: 'inherit' });
                    starting.on('error', e => {
                        console.error(e);
                    });
                    if (starting === null || starting === void 0 ? void 0 : starting.stdout) {
                        try {
                            for (var _d = true, _e = __asyncValues(starting.stdout), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                                _c = _f.value;
                                _d = false;
                                const data = _c;
                                console.log(`${chalk.green(`FusionAuth:`)} ${data}`);
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                        ;
                    }
                    starting.on('close', code => {
                        console.log(boxen(`The Docker container is shut down and the database has been destroyed.\nTo start it up, run ${chalk.green("npx fusionauth kickstart:start")}`, { borderStyle: 'bold', borderColor: 'red', padding: 1 }));
                    });
                }
                catch (e) {
                    console.error(e);
                }
            })).catch(e => {
                console.log(chalk.red("The process exited. Please try again."));
            });
        }
        catch (err) {
            console.log(err);
        }
    });
};
export const kickstartKill = new Command()
    .command('kickstart:kill')
    .description('Runs docker compose down in current directory')
    .action(action);
