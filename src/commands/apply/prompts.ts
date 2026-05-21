/**
 * Prompt utility for collecting user input interactively
 * Handles prompting users for variable values in the apply command
 */

import * as readline from 'node:readline';

/**
 * Prompt the user for hidden input (e.g., password)
 * Displays asterisks for each character typed but captures actual input
 */
async function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Use readline's built-in password-style input
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(prompt + ' ');

    const input: string[] = [];
    let charCount = 0;

    // Handle keypress events
    const onData = (char: Buffer) => {
      const code = char[0];

      // Enter key (13) or line feed (10)
      if (code === 13 || code === 10) {
        stdin.removeListener('data', onData);
        rl.close();
        stdout.write('\n');
        resolve(input.join(''));
      }
      // Backspace (127 or 8)
      else if (code === 127 || code === 8) {
        if (input.length > 0) {
          input.pop();
          charCount--;
          // Move cursor back, delete character, move cursor back again
          stdout.write('\x1b[1D\x1b[K');
        }
      }
      // Regular character
      else if (code >= 32 && code <= 126) {
        input.push(String.fromCharCode(code));
        charCount++;
        // Backspace over the typed character, then write asterisk
        stdout.write('\b*');
      }
      // Ignore other control characters
    };

    stdin.setRawMode(true);
    stdin.on('data', onData);
  });
}

/**
 * Prompt the user for input values
 * @param promptTexts Map of variable name to prompt text (regular prompts)
 * @param hiddenPromptTexts Map of variable name to prompt text (hidden prompts)
 * @returns Promise resolving to map of variable name to user input
 */
export async function collectPromptedValues(
  promptTexts: Map<string, string>,
  hiddenPromptTexts?: Map<string, string>
): Promise<Map<string, string>> {
  const totalPrompts = (promptTexts?.size || 0) + (hiddenPromptTexts?.size || 0);
  
  if (totalPrompts === 0) {
    return new Map();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const results = new Map<string, string>();

  try {
    // Collect regular prompts
    if (promptTexts && promptTexts.size > 0) {
      for (const [varName, promptText] of promptTexts) {
        const value = await new Promise<string>((resolve) => {
          rl.question(promptText + ' ', (answer) => {
            resolve(answer);
          });
        });

        results.set(varName, value);
      }
    }

    // Close readline before handling hidden prompts to avoid interference
    rl.close();

    // Collect hidden prompts
    if (hiddenPromptTexts && hiddenPromptTexts.size > 0) {
      for (const [varName, promptText] of hiddenPromptTexts) {
        const value = await promptHidden(promptText);
        results.set(varName, value);
      }
    }
  } catch (err) {
    rl.close();
    throw err;
  }

  return results;
}
