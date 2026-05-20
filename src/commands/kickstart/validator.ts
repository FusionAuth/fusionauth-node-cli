/**
 * Validator module for FusionAuth CLI Kickstart command
 * Handles schema validation, structure validation, and variable reference validation
 */

import * as fs from 'node:fs';
import {
  KickstartConfig,
  KickstartRequest,
  ValidationResult,
  ValidationError,
  ErrorCategory,
  HTTPMethod,
} from './types.js';

/**
 * Validates kickstart.json configuration files
 */
export class KickstartValidator {
  /**
   * Validate complete kickstart configuration
   * @param config The kickstart configuration to validate
   * @returns ValidationResult with errors if invalid
   */
  public validateConfig(config: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Type check
    if (!config || typeof config !== 'object') {
      errors.push({
        message: 'Kickstart configuration must be a valid JSON object',
        category: ErrorCategory.SCHEMA_INVALID,
      });
      return { valid: false, errors, warnings };
    }

    const cfg = config as Record<string, unknown>;

    // Validate variables (optional)
    if (cfg.variables !== undefined) {
      const variablesError = this.validateVariablesStructure(cfg.variables);
      if (variablesError) {
        errors.push(variablesError);
      }
    }

    // Validate apiKeys (optional)
    if (cfg.apiKeys !== undefined) {
      const apiKeysError = this.validateAPIKeysStructure(cfg.apiKeys);
      if (apiKeysError) {
        errors.push(...apiKeysError);
      }
    }

    // Validate requests (required)
    if (!cfg.requests) {
      errors.push({
        field: 'requests',
        message: 'Kickstart configuration must include a "requests" array',
        category: ErrorCategory.SCHEMA_INVALID,
      });
      return { valid: false, errors, warnings };
    }

    const requestsError = this.validateRequestsStructure(cfg.requests);
    if (requestsError.errors.length > 0) {
      errors.push(...requestsError.errors);
      warnings.push(...requestsError.warnings);
    }

    // If requests are valid, check for variable references
    if (errors.length === 0) {
      const variableRefErrors = this.validateVariableReferences(
        cfg as unknown as KickstartConfig
      );
      errors.push(...variableRefErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate that the kickstart file exists and is readable
   * @param filePath Path to the kickstart file
   * @returns ValidationResult
   */
  public validateFileExists(filePath: string): ValidationResult {
    const errors: ValidationError[] = [];

    try {
      if (!fs.existsSync(filePath)) {
        errors.push({
          message: `Kickstart file not found: ${filePath}`,
          category: ErrorCategory.FILE_NOT_FOUND,
        });
      } else if (!fs.statSync(filePath).isFile()) {
        errors.push({
          message: `Path is not a file: ${filePath}`,
          category: ErrorCategory.FILE_NOT_FOUND,
        });
      }
    } catch (err) {
      errors.push({
        message: `Cannot read file: ${filePath}`,
        category: ErrorCategory.FILE_NOT_FOUND,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate JSON structure of kickstart file
   * @param filePath Path to the kickstart file
   * @returns Parsed config if valid, or ValidationResult with errors
   */
  public loadAndValidateJSON(
    filePath: string
  ): { config: KickstartConfig } | ValidationResult {
    const fileError = this.validateFileExists(filePath);
    if (!fileError.valid) {
      return fileError;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content) as KickstartConfig;
      return { config };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        valid: false,
        errors: [
          {
            message: `Invalid JSON in kickstart file: ${message}`,
            category: ErrorCategory.SCHEMA_INVALID,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate variables object structure
   */
  private validateVariablesStructure(
    variables: unknown
  ): ValidationError | null {
    if (typeof variables !== 'object' || variables === null) {
      return {
        field: 'variables',
        message: 'Variables must be an object',
        category: ErrorCategory.SCHEMA_INVALID,
      };
    }

    return null;
  }

  /**
   * Validate apiKeys array structure
   */
  private validateAPIKeysStructure(apiKeys: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(apiKeys)) {
      errors.push({
        field: 'apiKeys',
        message: 'apiKeys must be an array',
        category: ErrorCategory.SCHEMA_INVALID,
      });
      return errors;
    }

    apiKeys.forEach((key, index) => {
      if (typeof key !== 'object' || key === null) {
        errors.push({
          field: `apiKeys[${index + 1}]`,
          message: 'Each API key must be an object',
          category: ErrorCategory.SCHEMA_INVALID,
        });
        return;
      }

      const keyObj = key as Record<string, unknown>;
      if (!keyObj.key || typeof keyObj.key !== 'string') {
        errors.push({
          field: `apiKeys[${index + 1}].key`,
          message: 'Each API key must have a "key" string property',
          category: ErrorCategory.SCHEMA_INVALID,
        });
      }
    });

    return errors;
  }

  /**
   * Validate requests array structure and individual requests
   */
  private validateRequestsStructure(
    requests: unknown
  ): { errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(requests)) {
      errors.push({
        field: 'requests',
        message: 'requests must be an array',
        category: ErrorCategory.SCHEMA_INVALID,
      });
      return { errors, warnings };
    }

    if (requests.length === 0) {
      errors.push({
        field: 'requests',
        message: 'requests array cannot be empty',
        category: ErrorCategory.SCHEMA_INVALID,
      });
      return { errors, warnings };
    }

    requests.forEach((request, index) => {
      if (typeof request !== 'object' || request === null) {
        errors.push({
          field: `requests[${index + 1}]`,
          message: 'Each request must be an object',
          category: ErrorCategory.SCHEMA_INVALID,
        });
        return;
      }

      const req = request as Record<string, unknown>;

      // Validate method
      if (!req.method || typeof req.method !== 'string') {
        errors.push({
          field: `requests[${index + 1}].method`,
          message: 'Each request must have a "method" string property',
          category: ErrorCategory.SCHEMA_INVALID,
        });
      } else if (
        !Object.values(HTTPMethod).includes(req.method as HTTPMethod)
      ) {
        errors.push({
          field: `requests[${index + 1}].method`,
          message: `Method must be one of: ${Object.values(HTTPMethod).join(', ')}. Got: ${req.method}`,
          category: ErrorCategory.SCHEMA_INVALID,
        });
      }

      // Validate URL
      if (!req.url || typeof req.url !== 'string') {
        errors.push({
          field: `requests[${index + 1}].url`,
          message: 'Each request must have a "url" string property',
          category: ErrorCategory.SCHEMA_INVALID,
        });
      } else if (!req.url.startsWith('/api/')) {
        warnings.push(
          `Request ${index + 1}: URL should start with "/api/": ${req.url}`
        );
      }

      // Validate body (optional but should be object if present)
      if (req.body !== undefined && typeof req.body !== 'object') {
        errors.push({
          field: `requests[${index + 1}].body`,
          message: 'Body must be an object if provided',
          category: ErrorCategory.SCHEMA_INVALID,
        });
      }

      // Validate contentType (optional, should be string if present)
      if (
        req.contentType !== undefined &&
        typeof req.contentType !== 'string'
      ) {
        errors.push({
          field: `requests[${index + 1}].contentType`,
          message: 'contentType must be a string if provided',
          category: ErrorCategory.SCHEMA_INVALID,
        });
      }

      // Validate tenantId (optional, should be string if present)
      if (req.tenantId !== undefined && typeof req.tenantId !== 'string') {
        errors.push({
          field: `requests[${index + 1}].tenantId`,
          message: 'tenantId must be a string if provided',
          category: ErrorCategory.SCHEMA_INVALID,
        });
      }
    });

    return { errors, warnings };
  }

  /**
   * Validate that all variable references are defined
   */
  private validateVariableReferences(
    config: KickstartConfig
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const definedVariables = new Set<string>(
      Object.keys(config.variables || {})
    );

    // Add default variables that are always available
    definedVariables.add('FUSIONAUTH_APPLICATION_ID');
    definedVariables.add('FUSIONAUTH_TENANT_ID');
    definedVariables.add('TENANT_MANAGER_ID');

    // Check requests
    config.requests.forEach((request, index) => {
      const variableRefs = this.extractVariableReferences(request);

      variableRefs.forEach((varRef) => {
        // UUID() is a special pattern
        if (varRef === 'UUID()') {
          return;
        }

        if (!definedVariables.has(varRef)) {
          errors.push({
            field: `requests[${index + 1}]`,
            stepId: `step-${String(index + 1).padStart(5, '0')}`,
            lineNumber: index,
            message: `Undefined variable: #{${varRef}}`,
            category: ErrorCategory.VARIABLE_NOT_DEFINED,
          });
        }
      });
    });

    // Check apiKeys if present
    if (config.apiKeys) {
      config.apiKeys.forEach((apiKey, index) => {
        const keyVarRefs = this.extractVariableReferencesFromString(apiKey.key);
        keyVarRefs.forEach((varRef) => {
          if (varRef !== 'UUID()' && !definedVariables.has(varRef)) {
            errors.push({
              field: `apiKeys[${index + 1}].key`,
              message: `Undefined variable: #{${varRef}}`,
              category: ErrorCategory.VARIABLE_NOT_DEFINED,
            });
          }
        });
      });
    }

    return errors;
  }

  /**
   * Extract variable references from a request
   * Returns array of variable names (without #{})
   */
  private extractVariableReferences(request: KickstartRequest): string[] {
    const refs = new Set<string>();

    // Check URL
    refs.forEach((ref) => {
      this.extractVariableReferencesFromString(request.url).forEach((r) =>
        refs.add(r)
      );
    });

    // Check tenantId
    if (request.tenantId) {
      this.extractVariableReferencesFromString(request.tenantId).forEach(
        (r) => refs.add(r)
      );
    }

    // Check body
    if (request.body) {
      this.extractVariableReferencesFromObject(request.body).forEach((r) =>
        refs.add(r)
      );
    }

    return Array.from(refs);
  }

  /**
   * Extract variable references from a string
   * Pattern: #{variableName} or #{UUID()} or #{FUSIONAUTH_*}
   */
  private extractVariableReferencesFromString(str: string): string[] {
    const pattern = /#{([^}]+)}/g;
    const matches: string[] = [];
    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(str)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  }

  /**
   * Extract variable references from an object (recursively)
   */
  private extractVariableReferencesFromObject(
    obj: Record<string, unknown>
  ): string[] {
    const refs = new Set<string>();

    const traverse = (value: unknown): void => {
      if (typeof value === 'string') {
        this.extractVariableReferencesFromString(value).forEach((r) =>
          refs.add(r)
        );
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
    return Array.from(refs);
  }
}
