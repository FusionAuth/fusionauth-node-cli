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

    type State = 'seekingProperty' | 'seekingArrayOpen' | 'inArray';
    let state: State = 'seekingProperty';
    let bracketDepth = 0; // tracks [ ] — array container boundary
    let objectDepth = 0;  // tracks { } — element boundaries
    let elementIndex = 0;
    let elementStartLine = 0;
    let inString = false;
    let escapeNext = false;

    // Process one character within the array; returns false when the array closes
    const processChar = (char: string, lineNumber: number): boolean => {
      if (escapeNext) { escapeNext = false; return true; }
      if (char === '\\' && inString) { escapeNext = true; return true; }
      if (char === '"') { inString = !inString; return true; }
      if (inString) return true;

      if (char === '[') {
        bracketDepth++;
      } else if (char === ']') {
        bracketDepth--;
        if (bracketDepth === 0) return false; // closing ] of the target array
      } else if (char === '{') {
        if (objectDepth === 0) elementStartLine = lineNumber;
        objectDepth++;
      } else if (char === '}') {
        objectDepth--;
        if (objectDepth === 0) {
          lineMap[elementIndex] = elementStartLine;
          elementIndex++;
          elementStartLine = 0;
        }
      }
      return true;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      if (state === 'seekingProperty') {
        const propIdx = line.indexOf(`"${arrayPath}"`);
        if (propIdx !== -1) {
          // Property found — look for [ on the same line first
          const bracketIdx = line.indexOf('[', propIdx);
          if (bracketIdx !== -1) {
            state = 'inArray';
            bracketDepth = 1;
            for (let j = bracketIdx + 1; j < line.length; j++) {
              if (!processChar(line[j], lineNumber)) return lineMap;
            }
          } else {
            state = 'seekingArrayOpen';
          }
        }
        continue;
      }

      if (state === 'seekingArrayOpen') {
        const bracketIdx = line.indexOf('[');
        if (bracketIdx !== -1) {
          state = 'inArray';
          bracketDepth = 1;
          for (let j = bracketIdx + 1; j < line.length; j++) {
            if (!processChar(line[j], lineNumber)) return lineMap;
          }
        }
        continue;
      }

      // state === 'inArray'
      for (let j = 0; j < line.length; j++) {
        if (!processChar(line[j], lineNumber)) return lineMap;
      }
    }

    return lineMap;
  }
}
