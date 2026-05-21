/**
 * FusionAuth CLI Apply Command
 * Reads a kickstart.json file and applies it to a FusionAuth instance
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import { apiKeyOption, hostOption } from '../options.js';
import {
  KickstartOptions,
  ExecutionMetrics,
  StepResult,
  StepStatus,
  ErrorCategory,
} from './apply/types.js';
import { KickstartValidator } from './kickstart/validator.js';
import { VariableSubstitutor } from './kickstart/variable-substitution.js';
import { HTTPClient, StepExecutor } from './apply/http-client.js';
import { logEvent } from '../utils.js';
import * as utils from '../utils.js';

const action = async function (options: Record<string, unknown>): Promise<void> {
  try {
    logEvent('cli command apply');
    await executeKickstart(options as Partial<KickstartOptions>);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    utils.errorAndExit(chalk.red(`✖ ${message}`));
  }
};

/**
 * Execute the apply command
 */
async function executeKickstart(options: Record<string, unknown>): Promise<void> {
  const opts = validateOptions(options as Partial<KickstartOptions>);

  if (!opts.quiet) {
    console.log(
      chalk.blue(
        `\n⚙️  FusionAuth CLI - Apply\n`
      )
    );
  }

  // Step 1: Load and validate kickstart file
  if (!opts.quiet) {
    console.log(chalk.gray('1️⃣  Loading and validating kickstart file...'));
  }

  const validator = new KickstartValidator();
  const loadResult = validator.loadAndValidateJSON(opts.file);

  if ('errors' in loadResult && !loadResult.valid) {
    let errorList: string[] = [];
    try {
      if (Array.isArray(loadResult.errors)) {
        errorList = loadResult.errors
          .map((e) => {
            if (e && typeof e === 'object' && 'message' in e) {
              return (e as { message: unknown }).message?.toString() || 'Unknown error';
            }
            return String(e);
          })
          .filter(Boolean);
      }
    } catch {
      errorList = ['Failed to parse errors'];
    }
    
    utils.errorAndExit(
      chalk.red(
        `✖ Failed to load kickstart file: ${errorList.length > 0 ? errorList.join(', ') : 'Unknown error'}`
      ),
      2
    );
    return;
  }

  const { config } = loadResult as { config: unknown };
  const configValidation = validator.validateConfig(config);

  if (!configValidation.valid) {
    let errorMessages = '';
    try {
      errorMessages = configValidation.errors
        .map((e) => {
          // Safely handle error objects
          if (e && typeof e === 'object' && 'message' in e) {
            const error = e as {field?: unknown; message: unknown};
            return `  ${(error.field?.toString() || 'config')}: ${error.message?.toString() || 'Unknown'}`;
          }
          return `  ${String(e)}`;
        })
        .join('\n');
    } catch {
      errorMessages = '  Failed to parse validation errors';
    }
    utils.errorAndExit(
      chalk.red(`✖ Invalid kickstart configuration:\n${errorMessages || '  Unknown error'}`),
      2
    );
    return;
  }

  if (!opts.quiet) {
    console.log(chalk.green('✓ Kickstart file validated'));
  }

  // Step 2: Resolve variables
  if (!opts.quiet) {
    console.log(chalk.gray('2️⃣  Resolving variables...'));
  }

  const substituter = new VariableSubstitutor();
  const kickstartConfig = config as { variables?: Record<string, unknown> };
  substituter.initialize(
    kickstartConfig.variables || {},
    opts.file
  );

  const resolved = substituter.resolveVariables(kickstartConfig as never);

  if (!opts.quiet) {
    console.log(
      chalk.green(
        `✓ Resolved ${resolved.size} variables`
      )
    );
  }

  if (opts.verbose) {
    console.log(chalk.gray('   Resolved variables:'));
    for (const [key, value] of resolved) {
      const displayValue = typeof value === 'object' 
        ? JSON.stringify(value).substring(0, 50) + '...'
        : String(value).substring(0, 50);
      console.log(chalk.gray(`     ${key}: ${displayValue}`));
    }
  }

  // Step 3: Check server connectivity
  if (!opts.quiet) {
    console.log(chalk.gray('3️⃣  Checking FusionAuth server connectivity...'));
  }

  const httpClient = new HTTPClient(opts.host, opts.key);

  try {
    await httpClient.waitForServerReady(15, 2000);
    if (!opts.quiet) {
      console.log(chalk.green('✓ Connected to FusionAuth'));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    utils.errorAndExit(
      chalk.red(`✖ Cannot connect to FusionAuth: ${message}`)
    );
    return;
  }

  // Step 4: Process requests
  const requests = (kickstartConfig as { requests?: unknown[] }).requests || [];
  const stepExecutor = new StepExecutor(httpClient);
  const metrics: ExecutionMetrics = {
    totalDurationMs: 0,
    startTime: new Date(),
    endTime: new Date(),
    stepsExecuted: 0,
    stepsSucceeded: 0,
    stepsFailed: 0,
    stepsSkipped: 0,
    stepsWarned: 0,
    successRate: 0,
    averageStepDurationMs: 0,
    requestSizeBytes: 0,
    responseSizeBytes: 0,
  };

  if (!opts.quiet) {
    console.log(
      chalk.gray(
        `\n4️⃣  Processing ${requests.length} request(s)...\n`
      )
    );
  }

  const stepResults: StepResult[] = [];
  let hasErrors = false;

  for (let index = 0; index < requests.length; index++) {
    const stepId = `step-${String(index + 1).padStart(5, '0')}`;
    const request = requests[index] as Record<string, unknown>;

    if (!opts.quiet) {
      process.stdout.write(
        chalk.gray(
          `   [${index + 1}/${requests.length}] ${request.method as string} ${request.url as string}...`
        )
      );
    }

    // Substitute variables in request
    const substituted = substituter.substituteRequest(
      request as never,
      resolved
    );

    if (opts.verbose && substituted.request.body) {
      console.log(chalk.gray(`     Request body: ${JSON.stringify(substituted.request.body, null, 2)}`));
    }

    if (substituted.errors.length > 0) {
      const stepResult: StepResult = {
        id: stepId,
        action: request.method as string,
        status: StepStatus.FAILED,
        sourceLineNumber: index,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        error: {
          category: ErrorCategory.INVALID_PAYLOAD,
          message: substituted.errors.join('; '),
        },
      };
      stepResults.push(stepResult);

      if (!opts.quiet) {
        console.log(chalk.red(' ✖'));
        if (opts.verbose) {
          console.log(chalk.red(`     Substitution errors: ${substituted.errors.join('; ')}`));
        }
      }

      metrics.stepsExecuted++;
      metrics.stepsFailed++;

      if (!opts.continueOnError) {
        hasErrors = true;
        break;
      }

      continue;
    }

    // Dry-run mode: skip actual execution
    if (opts.dryRun) {
      const stepResult: StepResult = {
        id: stepId,
        action: request.method as string,
        status: StepStatus.SUCCESS,
        sourceLineNumber: index,
        request: {
          method: substituted.request.method,
          url: substituted.request.url,
        },
        completedAt: new Date().toISOString(),
        durationMs: 0,
      };
      stepResults.push(stepResult);

      if (!opts.quiet) {
        console.log(chalk.cyan(' [DRY-RUN]'));
      }

      metrics.stepsSkipped++;
      continue;
    }

    // Execute request
    try {
      const { response, durationMs } = await stepExecutor.executeStep({
        id: stepId,
        index,
        sourceLineNumber: index,
        request: request as never,
        substitutedRequest: substituted.request,
      });

      metrics.stepsExecuted++;

      if (stepExecutor.isSuccessResponse(response)) {
        const stepResult: StepResult = {
          id: stepId,
          action: request.method as string,
          status: StepStatus.SUCCESS,
          sourceLineNumber: index,
          request: {
            method: substituted.request.method,
            url: substituted.request.url,
          },
          response: {
            status: response.status,
            contentType: response.contentType,
          },
          completedAt: new Date().toISOString(),
          durationMs,
        };
        stepResults.push(stepResult);

        if (!opts.quiet) {
          console.log(chalk.green(` ✓ (${durationMs}ms)`));
          if (opts.verbose) {
            console.log(chalk.gray(`     Response status: ${response.status}`));
            if (typeof response.body === 'object' && response.body !== null && Object.keys(response.body).length > 0) {
              console.log(chalk.gray(`     Response: ${JSON.stringify(response.body, null, 2)}`));
            }
          }
        }

        metrics.stepsSucceeded++;
        metrics.averageStepDurationMs += durationMs;
      } else {
        const { category, message } = stepExecutor.extractErrorDetails(response);

        // Check if this is a duplicate/already exists warning
        const responseBody = response.body as Record<string, unknown>;
        const isDuplicate =
          // Check fieldErrors for [duplicate] codes
          (responseBody?.fieldErrors && 
            typeof responseBody.fieldErrors === 'object' &&
            Object.values(responseBody.fieldErrors as Record<string, unknown>).some((fieldError: unknown) => {
              if (Array.isArray(fieldError)) {
                return fieldError.some((e: unknown) =>
                  typeof e === 'object' && e !== null &&
                  ((e as Record<string, unknown>)?.code?.toString().includes('[duplicate]') ||
                   (e as Record<string, unknown>)?.message?.toString().includes('already exists'))
                );
              }
              return false;
            })) ||
          // Check generalErrors for [duplicate] codes
          (responseBody?.generalErrors && 
            Array.isArray(responseBody.generalErrors) &&
            (responseBody.generalErrors as unknown[]).some((e: unknown) =>
              typeof e === 'object' && e !== null &&
              ((e as Record<string, unknown>)?.code === '[duplicate]' ||
               (e as Record<string, unknown>)?.message?.toString().includes('already exists'))
            )) ||
          message.includes('[duplicate]') ||
          message.includes('already exists');

        const stepResult: StepResult = {
          id: stepId,
          action: request.method as string,
          status: isDuplicate ? StepStatus.WARNING : StepStatus.FAILED,
          sourceLineNumber: index,
          request: {
            method: substituted.request.method,
            url: substituted.request.url,
          },
          response: {
            status: response.status,
            contentType: response.contentType,
            body: response.body as Record<string, unknown>,
          },
          completedAt: new Date().toISOString(),
          durationMs,
          error: {
            category: category as ErrorCategory,
            message,
            statusCode: response.status,
            responseBody: response.body as Record<string, unknown>,
          },
        };
        stepResults.push(stepResult);

        if (!opts.quiet) {
          if (isDuplicate) {
            console.log(chalk.yellow(` ⚠ (${response.status} - duplicate)`));
            if (opts.verbose) {
              console.log(chalk.yellow(`     Warning: ${message}`));
            }
          } else {
            console.log(chalk.red(` ✖ (${response.status} ${response.statusText})`));
            if (opts.verbose) {
              console.log(chalk.gray(`     Error: ${message}`));
              if (typeof response.body === 'object' && response.body !== null) {
                console.log(chalk.gray(`     Response: ${JSON.stringify(response.body, null, 2)}`));
              }
            }
          }
        }

        if (isDuplicate) {
          metrics.stepsWarned++;
        } else {
          metrics.stepsFailed++;
        }

        if (!opts.continueOnError) {
          hasErrors = true;
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      const stepResult: StepResult = {
        id: stepId,
        action: request.method as string,
        status: StepStatus.FAILED,
        sourceLineNumber: index,
        request: {
          method: substituted.request.method,
          url: substituted.request.url,
        },
        completedAt: new Date().toISOString(),
        durationMs: 0,
        error: {
          category: ErrorCategory.NETWORK_ERROR,
          message,
        },
      };
      stepResults.push(stepResult);

      if (!opts.quiet) {
        console.log(chalk.red(` ✖ (${message})`));
      }

      metrics.stepsExecuted++;
      metrics.stepsFailed++;

      if (!opts.continueOnError) {
        hasErrors = true;
        break;
      }
    }
  }

  // Step 5: Summary
  metrics.endTime = new Date();
  metrics.totalDurationMs =
    metrics.endTime.getTime() - metrics.startTime.getTime();

  if (metrics.stepsExecuted > 0) {
    metrics.averageStepDurationMs = Math.round(
      metrics.averageStepDurationMs / metrics.stepsExecuted
    );
  }

  metrics.successRate =
    metrics.stepsExecuted > 0
      ? Math.round((metrics.stepsSucceeded / metrics.stepsExecuted) * 100)
      : 0;

  if (!opts.quiet) {
    console.log();
    console.log(chalk.gray('═'.repeat(60)));
    console.log(
      chalk.blue(
        `\n📊 Summary (${(metrics.totalDurationMs / 1000).toFixed(2)}s)\n`
      )
    );
    console.log(
      `  Executed: ${chalk.cyan(metrics.stepsExecuted)} | Success: ${chalk.green(metrics.stepsSucceeded)} | Warnings: ${chalk.yellow(metrics.stepsWarned)} | Failed: ${chalk.red(metrics.stepsFailed)}`
    );

    if (opts.dryRun) {
      console.log(`  Dry-run: ${chalk.yellow(metrics.stepsSkipped)}`);
    }

    console.log(`  Success Rate: ${chalk.bold(metrics.successRate)}%`);
    console.log();
  }

  // Write log file if requested
  if (opts.logFile) {
    writeLogFile(opts.logFile, stepResults, metrics, opts.dryRun || false);
  }

  const exitCode = hasErrors || metrics.stepsFailed > 0 ? 2 : 0;

  if (exitCode === 0) {
    if (!opts.quiet) {
      console.log(chalk.green('✓ Kickstart applied successfully!'));
    }
    process.exit(0);
  } else {
    if (!opts.quiet) {
      utils.errorAndExit(
        chalk.red(
          `✖ Kickstart failed (${metrics.stepsFailed} error(s))`
        ),
        exitCode
      );
    } else {
      process.exit(exitCode);
    }
  }
}

/**
 * Write execution results to a log file
 */
function writeLogFile(
  logFilePath: string,
  stepResults: StepResult[],
  metrics: ExecutionMetrics,
  isDryRun: boolean
): void {
  try {
    const timestamp = new Date().toISOString();
    
    // Determine output path
    let outputPath = logFilePath;
    if (!logFilePath || logFilePath.trim() === '') {
      // Auto-generate filename with timestamp if no specific path given
      outputPath = `kickstart-${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}-${Date.now()}.json`;
    }

    const logData = {
      timestamp,
      isDryRun,
      metrics: {
        totalDurationMs: metrics.totalDurationMs,
        startTime: metrics.startTime,
        endTime: metrics.endTime,
        stepsExecuted: metrics.stepsExecuted,
        stepsSucceeded: metrics.stepsSucceeded,
        stepsWarned: metrics.stepsWarned,
        stepsFailed: metrics.stepsFailed,
        stepsSkipped: metrics.stepsSkipped,
        successRate: metrics.successRate,
      },
      steps: stepResults,
    };

    fs.writeFileSync(outputPath, JSON.stringify(logData, null, 2), 'utf-8');
    console.log(chalk.gray(`\n✓ Execution log written to: ${outputPath}`));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.log(
      chalk.yellow(`⚠ Warning: Failed to write log file: ${message}`)
    );
  }
}

/**
 * Validate and normalize command options
 */
function validateOptions(options: Partial<KickstartOptions>): KickstartOptions {
  const errors: string[] = [];

  if (!options.file) {
    errors.push('--file is required');
  }

  if (!options.key) {
    errors.push('The apply command requires an existing API Key supplied in the command');
  }

  if (errors.length > 0) {
    utils.errorAndExit(chalk.red(`Missing required options:\n  ${errors.join('\n  ')}`));
  }

  return {
    host: options.host || 'http://localhost:9011',
    key: options.key!,
    file: options.file!,
    dryRun: options.dryRun || false,
    continueOnError: options.continueOnError || false,
    verbose: options.verbose || false,
    quiet: options.quiet || false,
    logFile: options.logFile,
  };
}

/**
 * Apply Command
 */
export const applyCommand = new Command()
  .command('apply')
  .description('Apply a kickstart.json configuration to a FusionAuth instance')
  .addOption(hostOption)
  .addOption(apiKeyOption)
  .option('-f, --file <path>', 'Path to kickstart.json file')
  .option(
    '-d, --dry-run',
    'Validate configuration without making API calls',
    false
  )
  .option(
    '-e, --continue-on-error',
    'Continue executing steps even if one fails',
    false
  )
  .option('-v, --verbose', 'Show detailed output including request/response', false)
  .option('-q, --quiet', 'Minimize output', false)
  .option('--log-file <path>', 'Write execution results to a log file')
  .action(action);
