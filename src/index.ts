#! /usr/bin/env node

import figlet from 'figlet';
import {Command} from 'commander';
import chalk from 'chalk';
import {themeDownload, themeUpload, themeWatch} from './commands/index.js';

const f = figlet.textSync('Fusion').split('\n');
const a = figlet.textSync('Auth').split('\n');

f.forEach((line, i) => {
    console.log(chalk.white(line) + chalk.hex('#F58320')(a[i]));
});

const program = new Command();
program
    .name('@fusionauth/cli')
    .description('CLI for FusionAuth')
    .version('1.0.0');

program.addCommand(themeDownload);
program.addCommand(themeUpload);
program.addCommand(themeWatch);

program.parse();
