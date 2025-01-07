#! /usr/bin/env -S node --no-warnings=ExperimentalWarning

import figlet from 'figlet';
import {Command} from '@commander-js/extra-typings';
import chalk from 'chalk';
import * as commands from './commands/index.js';
// @ts-ignore
import pkg from '../package.json' with { type: 'json' };

const fusionString = figlet.textSync('Fusion').split('\n');
const authString = figlet.textSync('Auth').split('\n');

fusionString.forEach((line, i) => {
    console.log(chalk.white(line) + chalk.hex('#F58320')(authString[i]));
});

const program = new Command();
program
    .name('@fusionauth/cli')
    .description('CLI for FusionAuth')
    .version(pkg.version);

Object.values(commands).forEach(command => program.addCommand(command));

program.parse();
