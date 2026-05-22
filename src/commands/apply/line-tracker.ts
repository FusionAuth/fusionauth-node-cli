/**
 * Utility to track line numbers in JSON files for array elements
 * Maps parsed objects back to their line numbers in the source file
 */

import * as fs from 'node:fs';

/**
 * Maps array indices to their starting line numbers in the JSON file
 */
export interface LineNumberMap {
  [index: number]: number;
}

/**
 * Track line numbers for array elements in a JSON file
 * Useful for accurate error reporting with file locations
 */
export class LineTracker {
  /**
   * Get line numbers for each element in a JSON array
   * @param filePath Path to the JSON file
   * @param arrayPath Path to the array property (e.g., 'requests')
   * @returns Map of array index to starting line number (1-indexed)
   */
  static getArrayLineNumbers(filePath: string, arrayPath: string): LineNumberMap {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const lineMap: LineNumberMap = {};

    // Find the "requests" property and track array element positions
    let inRequestsArray = false;
    let arrayDepth = 0;
    let elementIndex = 0;
    let elementStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1; // 1-indexed

      // Look for the "requests" array start
      if (!inRequestsArray) {
        if (line.includes(`"${arrayPath}"`) && line.includes('[')) {
          inRequestsArray = true;
          arrayDepth = 1;
          // Check if there's content after the [
          const afterBracket = line.substring(line.indexOf('[') + 1).trim();
          if (afterBracket.startsWith('{')) {
            elementStartLine = lineNumber;
          }
        }
        continue;
      }

      // Process lines within the requests array
      if (inRequestsArray) {
        // Track bracket nesting
        for (let j = 0; j < line.length; j++) {
          const char = line[j];

          if (char === '{') {
            if (arrayDepth === 1) {
              // Start of a new array element
              elementStartLine = lineNumber;
            }
            arrayDepth++;
          } else if (char === '}') {
            arrayDepth--;
            if (arrayDepth === 1) {
              // End of array element
              lineMap[elementIndex] = elementStartLine;
              elementIndex++;
              elementStartLine = 0;
            } else if (arrayDepth === 0) {
              // End of array
              return lineMap;
            }
          }
        }
      }
    }

    return lineMap;
  }
}

