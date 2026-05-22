/**
 * Type definitions for the FusionAuth CLI Apply command
 * Defines interfaces, enums, and error classes for the apply functionality
 */

/**
 * HTTP methods supported by the apply system
 */
export enum HTTPMethod {
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT',
}


/**
 * Status of a apply step execution
 */
export enum StepStatus {
  FAILED = 'failed',
  PENDING = 'pending',
  SKIPPED = 'skipped',
  SUCCESS = 'success',
  WARNING = 'warning',
}

/**
 * Categories of errors that can occur during apply execution
 */
export enum ErrorCategory {
  SCHEMA_INVALID = 'schema_invalid',
  VARIABLE_NOT_DEFINED = 'variable_not_defined',
  AUTHENTICATION_FAILED = 'authentication_failed',
  NETWORK_ERROR = 'network_error',
  RESOURCE_CONFLICT = 'resource_conflict',
  SERVER_ERROR = 'server_error',
  INVALID_PAYLOAD = 'invalid_payload',
  FILE_NOT_FOUND = 'file_not_found',
  UNKNOWN = 'unknown',
}

/**
 * Variable definitions that can be referenced in kickstart requests
 * Values can be strings, numbers, booleans, or objects
 */
export type KickstartVariable = string | number | boolean | Record<string, unknown>;

/**
 * Single API request to be executed as part of the kickstart
 */
export interface KickstartRequest {
  method: HTTPMethod | string;
  url: string;
  body?: Record<string, unknown>;
  tenantId?: string;
  contentType?: string;
}

/**
 * Complete kickstart configuration from kickstart.json file
 */
export interface KickstartConfig {
  variables?: Record<string, KickstartVariable>;
  requests: KickstartRequest[];
  settings?: {
    readTimeout?: string;
    connectTimeout?: string;
  };
}

/**
 * Result of executing a single step in the kickstart
 */
export interface StepResult {
  id: string;
  action: HTTPMethod | string;
  status: StepStatus;
  sourceLineNumber?: number;
  completedAt: string;
  durationMs: number;
  request?: {
    method: string;
    url: string;
  };
  response?: {
    status: number;
    body?: Record<string, unknown>;
    contentType?: string;
  };
  error?: {
    category: ErrorCategory;
    message: string;
    statusCode?: number;
    responseBody?: Record<string, unknown>;
  };
}

/**
 * Command-line options passed to the apply command
 */
export interface ApplyOptions {
  file: string;
  continueOnError?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  logFile?: string;
}

/**
 * Metrics collected during apply execution
 */
export interface ExecutionMetrics {
  totalDurationMs: number;
  startTime: Date;
  endTime: Date;
  stepsExecuted: number;
  stepsSucceeded: number;
  stepsFailed: number;
  stepsSkipped: number;
  stepsWarned: number;
  successRate: number;
  averageStepDurationMs: number;
  requestSizeBytes: number;
  responseSizeBytes: number;
}

/**
 * Structured error details for apply validation or execution errors
 */
export interface ValidationError {
  field?: string;
  stepId?: string;
  lineNumber?: number;
  message: string;
  category: ErrorCategory;
}

/**
 * Validation result returned by validator
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Substitution result after replacing variables
 */
export interface SubstitutionResult {
  success: boolean;
  value: unknown;
  unresolvedVariables: string[];
  errors: string[];
}

/**
 * HTTP response from a kickstart request
 */
export interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | string;
  contentType?: string;
}

/**
 * Configuration for HTTP client timeouts
 */
export interface TimeoutConfig {
  connectTimeoutMs: number;
  readTimeoutMs: number;
}

/**
 * Maps request array indices to their starting line numbers in the JSON file
 */
export interface RequestLineNumbers {
  [index: number]: number;
}

/**
 * Parsed step information with metadata
 */
export interface ParsedStep {
  id: string;
  index: number;
  sourceLineNumber?: number;
  request: KickstartRequest;
  substitutedRequest: KickstartRequest;
}
