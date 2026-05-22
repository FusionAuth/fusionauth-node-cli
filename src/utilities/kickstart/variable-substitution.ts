/**
 * Variable Substitution Engine for FusionAuth CLI Kickstart command
 * Handles variable resolution, file inclusion, and template processing
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  KickstartConfig,
  KickstartRequest,
  SubstitutionResult,
} from '../apply/types.js';

/**
 * Patterns for template substitution:
 * - #{variableName} or #{variableName?number}
 * - #{UUID()}
 * - #{ENV.VARNAME}
 * - @{filePath} - include file unescaped
 * - ${filePath} - include file JSON-escaped
 */
export class VariableSubstitutor {
  private variables: Map<string, unknown> = new Map();
  private kickstartDir: string = process.cwd();
  private fileCache: Map<string, string> = new Map();

  // Default values for common FusionAuth variables
  private static readonly DEFAULT_VARIABLES: Record<string, string> = {
    FUSIONAUTH_APPLICATION_ID: '3c219e58-ed0e-4b18-ad48-f4f92793ae32',
    FUSIONAUTH_TENANT_ID: '886a57e0-f2ac-440a-9a9d-d10c17b6f1a1',
    TENANT_MANAGER_ID: '9ab52a6b-6abc-4aea-8f7b-525156b2ef73',
  };

  /**
   * Initialize substitution engine with variables and kickstart directory
   * @param variables The variables map from kickstart config
   * @param kickstartFilePath Path to the kickstart.json file (used for relative file paths)
   */
  public initialize(
    variables: Record<string, unknown>,
    kickstartFilePath: string
  ): void {
    this.variables = new Map();
    this.kickstartDir = path.dirname(path.resolve(kickstartFilePath));
    this.fileCache = new Map();

    // Add default variables first (can be overridden by explicit values)
    for (const [key, value] of Object.entries(
      VariableSubstitutor.DEFAULT_VARIABLES
    )) {
      this.variables.set(key, value);
    }

    // Add provided variables (these override defaults)
    for (const [key, value] of Object.entries(variables)) {
      this.variables.set(key, value);
    }
  }

  /**
   * Resolve all variables, expanding special patterns like #{UUID()} and #{ENV.VARNAME}
   * @param config The kickstart configuration
   * @returns Map of resolved variables
   */
  public resolveVariables(config: KickstartConfig): Map<string, unknown> {
    const resolved = new Map<string, unknown>();

    // First pass: add all direct variables
    for (const [key, value] of this.variables.entries()) {
      resolved.set(key, value);
    }

    // Second pass: process special patterns
    for (const [key, value] of this.variables.entries()) {
      if (typeof value === 'string') {
        const result = this.resolveSpecialPattern(value);
        if (result.success) {
          resolved.set(key, result.value);
        }
      }
    }

    return resolved;
  }

  /**
   * Substitute variables and file inclusions in an object (recursively)
   * @param obj Object to process (typically the request body)
   * @param resolved Map of resolved variables
   * @returns Substituted object
   */
  public substituteInObject(
    obj: unknown,
    resolved: Map<string, unknown>
  ): SubstitutionResult {
    const unresolvedVariables: string[] = [];
    const errors: string[] = [];

    try {
      const result = this.deepSubstitute(obj, resolved, unresolvedVariables);
      // Convert unresolved variables to error messages
      const errorMessages = unresolvedVariables.map(
        (v) => `Unresolved variable: #{${v}}`
      );
      return {
        success: errors.length === 0 && unresolvedVariables.length === 0,
        value: result,
        unresolvedVariables,
        errors: [...errors, ...errorMessages],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        value: obj,
        unresolvedVariables,
        errors: [message],
      };
    }
  }

  /**
   * Substitute variables in a string
   * @param str String to process
   * @param resolved Map of resolved variables
   * @returns Substituted string or error
   */
  public substituteInString(
    str: string,
    resolved: Map<string, unknown>
  ): SubstitutionResult {
    const unresolvedVariables: string[] = [];
    const errors: string[] = [];

    try {
      const result = this.substituteString(str, resolved, unresolvedVariables);
      // Convert unresolved variables to error messages
      const errorMessages = unresolvedVariables.map(
        (v) => `Unresolved variable: #{${v}}`
      );
      return {
        success: errors.length === 0 && unresolvedVariables.length === 0,
        value: result,
        unresolvedVariables,
        errors: [...errors, ...errorMessages],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        value: str,
        unresolvedVariables,
        errors: [message],
      };
    }
  }

  /**
   * Substitute a complete kickstart request
   * @param request The request to process
   * @param resolved Map of resolved variables
   * @returns Substituted request
   */
  public substituteRequest(
    request: KickstartRequest,
    resolved: Map<string, unknown>
  ): { request: KickstartRequest; errors: string[] } {
    const errors: string[] = [];

    // Substitute URL
    const urlResult = this.substituteInString(request.url, resolved);
    if (!urlResult.success) {
      errors.push(`URL substitution failed: ${urlResult.errors.join(', ')}`);
    }

    // Substitute tenantId if present
    let tenantId = request.tenantId;
    if (tenantId) {
      const tenantResult = this.substituteInString(tenantId, resolved);
      if (!tenantResult.success) {
        errors.push(
          `TenantId substitution failed: ${tenantResult.errors.join(', ')}`
        );
      } else {
        tenantId = tenantResult.value as string;
      }
    }

    // Substitute body if present
    let body = request.body;
    if (body) {
      const bodyResult = this.substituteInObject(body, resolved);
      if (!bodyResult.success) {
        errors.push(`Body substitution failed: ${bodyResult.errors.join(', ')}`);
      } else {
        body = bodyResult.value as Record<string, unknown>;
      }
    }

    return {
      request: {
        method: request.method,
        url: urlResult.value as string,
        body,
        tenantId,
        contentType: request.contentType,
      },
      errors,
    };
  }

  /**
   * Deep recursively substitute in an object
   */
  private deepSubstitute(
    value: unknown,
    resolved: Map<string, unknown>,
    unresolvedVariables: string[]
  ): unknown {
    if (typeof value === 'string') {
      return this.substituteString(value, resolved, unresolvedVariables);
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        this.deepSubstitute(item, resolved, unresolvedVariables)
      );
    }

    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(obj)) {
        result[key] = this.deepSubstitute(val, resolved, unresolvedVariables);
      }

      return result;
    }

    return value;
  }

  /**
   * Substitute patterns in a string
   * Handles: #{var}, #{var?number}, #{UUID()}, #{ENV.VAR}, @{file}, ${file}
   */
  private substituteString(
    str: string,
    resolved: Map<string, unknown>,
    unresolvedVariables: string[]
  ): string {
    let result = str;

    // File inclusion patterns must be processed first (they return strings)
    // @{file} - unescaped inclusion
    result = result.replace(/@{([^}]+)}/g, (match, filePath) => {
      const content = this.includeFile(filePath, false);
      if (content === null) {
        throw new Error(`Cannot include file: ${filePath}`);
      }
      return content;
    });

    // ${file} - JSON-escaped inclusion
    result = result.replace(/\${([^}]+)}/g, (match, filePath) => {
      const content = this.includeFile(filePath, true);
      if (content === null) {
        throw new Error(`Cannot include file: ${filePath}`);
      }
      return content;
    });

    // Variable patterns: #{var} or #{var?number}
    result = result.replace(/#{([^}?]+)(\?[a-z]+)?}/g, (match, varName, typeHint) => {
      const value = this.resolveVariable(varName, resolved);

      if (value === undefined) {
        if (!unresolvedVariables.includes(varName)) {
          unresolvedVariables.push(varName);
        }
        return match; // Return unchanged if not found
      }

      // Handle type hints
      if (typeHint === '?number') {
        // For numeric context, just return the value as-is (no quotes)
        return String(value);
      }

      // For string context, convert to JSON-safe string
      if (typeof value === 'string') {
        return value;
      }

      if (typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    });

    return result;
  }

  /**
   * Resolve a single variable or special pattern
   * Returns undefined if variable not found
   */
  private resolveVariable(
    varName: string,
    resolved: Map<string, unknown>
  ): unknown {
    // Special pattern: UUID()
    if (varName === 'UUID()') {
      return this.generateUUID();
    }

    // Special pattern: ENV.VARNAME
    if (varName.startsWith('ENV.')) {
      const envVar = varName.substring(4);
      return process.env[envVar];
    }

    // Check resolved map first (includes both user variables and defaults)
    const value = resolved.get(varName);
    if (value !== undefined) {
      return value;
    }

    // For FUSIONAUTH_* variables, also check environment as fallback
    if (varName.startsWith('FUSIONAUTH_')) {
      return process.env[varName];
    }

    // Not found
    return undefined;
  }

  /**
   * Handle special patterns that need immediate resolution
   * Used during variable initialization
   */
  private resolveSpecialPattern(value: string): SubstitutionResult {
    // UUID() pattern
    if (value === '#{UUID()}') {
      return {
        success: true,
        value: this.generateUUID(),
        unresolvedVariables: [],
        errors: [],
      };
    }

    // ENV.VARNAME pattern
    if (value.startsWith('#{ENV.') && value.endsWith('}')) {
      const envVar = value.substring(6, value.length - 1);
      const envValue = process.env[envVar];

      if (envValue === undefined) {
        return {
          success: false,
          value,
          unresolvedVariables: [envVar],
          errors: [`Environment variable not found: ${envVar}`],
        };
      }

      return {
        success: true,
        value: envValue,
        unresolvedVariables: [],
        errors: [],
      };
    }

    // Not a special pattern, return as-is
    return {
      success: true,
      value,
      unresolvedVariables: [],
      errors: [],
    };
  }

  /**
   * Generate a new UUID
   */
  private generateUUID(): string {
    return randomUUID();
  }

  /**
   * Include file content at the specified path
   * @param filePath Relative path to file (relative to kickstart directory)
   * @param jsonEscape Whether to JSON-escape the content
   * @returns File content or null if file not found
   */
  private includeFile(filePath: string, jsonEscape: boolean): string | null {
    // Resolve file path relative to kickstart directory
    const fullPath = path.join(this.kickstartDir, filePath);

    // Security: prevent directory traversal attacks
    const resolvedPath = path.resolve(fullPath);
    const kickstartDirResolved = path.resolve(this.kickstartDir);

    if (!resolvedPath.startsWith(kickstartDirResolved)) {
      throw new Error(
        `Invalid file path: ${filePath} (directory traversal not allowed)`
      );
    }

    // Check cache first
    const cacheKey = `${fullPath}:${jsonEscape}`;
    if (this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey) || null;
    }

    try {
      let content = fs.readFileSync(fullPath, 'utf-8');

      // JSON-escape if needed
      if (jsonEscape) {
        content = JSON.stringify(content).slice(1, -1); // Remove surrounding quotes
      }

      this.fileCache.set(cacheKey, content);
      return content;
    } catch (err) {
      return null;
    }
  }

  /**
   * Clear file cache (useful for testing or when files change)
   */
  public clearFileCache(): void {
    this.fileCache.clear();
  }

  /**
   * Validate that all variable references in config are resolvable
   * @param config The kickstart configuration
   * @param resolved Map of resolved variables
   * @returns Array of unresolved variable names
   */
  public findUnresolvedVariables(
    config: KickstartConfig,
    resolved: Map<string, unknown>
  ): string[] {
    const unresolved = new Set<string>();

    // Check requests
    for (const request of config.requests) {
      this.findUnresolvedInString(request.url, resolved, unresolved);

      if (request.tenantId) {
        this.findUnresolvedInString(request.tenantId, resolved, unresolved);
      }

      if (request.body) {
        this.findUnresolvedInObject(request.body, resolved, unresolved);
      }
    }

    return Array.from(unresolved);
  }

  /**
   * Find unresolved variables in a string
   */
  private findUnresolvedInString(
    str: string,
    resolved: Map<string, unknown>,
    unresolved: Set<string>
  ): void {
    // Skip file inclusion patterns
    if (str.includes('@{') || str.includes('${')) {
      return;
    }

    const pattern = /#{([^}]+)}/g;
    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(str)) !== null) {
      const varName = match[1];

      // Skip special patterns
      if (varName === 'UUID()' || varName.startsWith('ENV.') || varName.startsWith('FUSIONAUTH_')) {
        continue;
      }

      if (!resolved.has(varName)) {
        unresolved.add(varName);
      }
    }
  }

  /**
   * Find unresolved variables in an object (recursively)
   */
  private findUnresolvedInObject(
    obj: Record<string, unknown>,
    resolved: Map<string, unknown>,
    unresolved: Set<string>
  ): void {
    const traverse = (value: unknown): void => {
      if (typeof value === 'string') {
        this.findUnresolvedInString(value, resolved, unresolved);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item) => traverse(item));
        } else {
          Object.values(value as Record<string, unknown>).forEach((item) =>
            traverse(item)
          );
        }
      }
    };

    traverse(obj);
  }

  /**
   * Detect if a value is a prompt variable (starts with "prompt:")
   * @param value The variable value
   * @returns true if value is a prompt variable
   */
  public isPromptVariable(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith('prompt:');
  }

  /**
   * Extract prompt text from a prompt variable
   * @param value The variable value (e.g., "prompt:Enter SMTP password:")
   * @returns The prompt text without the "prompt:" prefix
   */
  public extractPromptText(value: unknown): string {
    if (!this.isPromptVariable(value)) {
      return '';
    }
    return (value as string).substring('prompt:'.length);
  }

  /**
   * Get all variables that require user input (marked with "prompt:" prefix)
   * @param variables The variables from kickstart config
   * @returns Map of variable name to prompt text
   */
  public getPromptedVariables(variables: Record<string, unknown>): Map<string, string> {
    const prompted = new Map<string, string>();

    for (const [key, value] of Object.entries(variables)) {
      if (this.isPromptVariable(value)) {
        const promptText = this.extractPromptText(value);
        prompted.set(key, promptText);
      }
    }

    return prompted;
  }

  /**
   * Detect if a value is a hidden prompt variable (starts with "prompt-hidden:")
   * @param value The variable value
   * @returns true if value is a hidden prompt variable
   */
  public isHiddenPromptVariable(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith('prompt-hidden:');
  }

  /**
   * Extract prompt text from a hidden prompt variable
   * @param value The variable value (e.g., "prompt-hidden:Enter password:")
   * @returns The prompt text without the "prompt-hidden:" prefix
   */
  public extractHiddenPromptText(value: unknown): string {
    if (!this.isHiddenPromptVariable(value)) {
      return '';
    }
    return (value as string).substring('prompt-hidden:'.length);
  }

  /**
   * Get all variables that require hidden user input (marked with "prompt-hidden:" prefix)
   * @param variables The variables from kickstart config
   * @returns Map of variable name to prompt text
   */
  public getHiddenPromptedVariables(variables: Record<string, unknown>): Map<string, string> {
    const prompted = new Map<string, string>();

    for (const [key, value] of Object.entries(variables)) {
      if (this.isHiddenPromptVariable(value)) {
        const promptText = this.extractHiddenPromptText(value);
        prompted.set(key, promptText);
      }
    }

    return prompted;
  }
}
