/**
 * Type definitions for the FusionAuth CLI Kickstart command
 * Defines interfaces, enums, and error classes for the kickstart-apply functionality
 */

/**
 * HTTP methods supported by the kickstart system
 */
export enum HTTPMethod {
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT',
}

/**
 * Status of a kickstart step execution
 */
export enum StepStatus {
  FAILED = 'failed',
  PENDING = 'pending',
  SKIPPED = 'skipped',
  SUCCESS = 'success',
  WARNING = 'warning',
}

/**
 * Categories of errors that can occur during kickstart execution
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
 * API key configuration for kickstart
 */
export interface KickstartAPIKey {
  key: string;
  description?: string;
  keyManager?: boolean;
  ipAccessControlListId?: string;
  tenantId?: string;
  permissions?: Record<string, unknown>;
}

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
  apiKeys?: KickstartAPIKey[];
  requests: KickstartRequest[];
  licenseId?: string;
  license?: Record<string, unknown>;
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
 * Complete execution state for a kickstart run
 */
export interface ExecutionState {
  kickstartId: string;
  startedAt: string;
  completedAt?: string;
  lastStepCompleted: number;
  totalSteps: number;
  status: 'in_progress' | 'completed' | 'failed';
  steps: StepResult[];
}

/**
 * Command-line options passed to kickstart-apply
 */
export interface KickstartOptions {
  host: string;
  key: string;
  file: string;
  wipe?: boolean;
  continueOnError?: boolean;
  resume?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  logFile?: string;
}

/**
 * Metrics collected during kickstart execution
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
 * Structured error details for kickstart validation or execution errors
 */
export interface ValidationError {
  field?: string;
  stepId?: string;
  lineNumber?: number;
  message: string;
  category: ErrorCategory;
}

/**
 * Custom error for kickstart validation failures
 */
export class KickstartValidationError extends Error {
  constructor(
    message: string,
    public errors: ValidationError[] = [],
    public category: ErrorCategory = ErrorCategory.SCHEMA_INVALID
  ) {
    super(message);
    this.name = 'KickstartValidationError';
  }
}

/**
 * Custom error for kickstart execution failures
 */
export class KickstartExecutionError extends Error {
  constructor(
    message: string,
    public stepId: string,
    public category: ErrorCategory = ErrorCategory.UNKNOWN,
    public statusCode?: number,
    public responseBody?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'KickstartExecutionError';
  }
}

/**
 * Result of a dry-run validation
 */
export interface DryRunResult {
  valid: boolean;
  totalSteps: number;
  stepsToExecute: StepResult[];
  warnings: string[];
  errors: ValidationError[];
}

/**
 * Response from executor after executing a kickstart
 */
export interface ExecutionResult {
  success: boolean;
  kickstartId: string;
  executionState: ExecutionState;
  metrics: ExecutionMetrics;
  errors: KickstartExecutionError[];
  stateFilePath: string;
  exitCode: number;
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
 * Parsed step information with metadata
 */
export interface ParsedStep {
  id: string;
  index: number;
  sourceLineNumber?: number;
  request: KickstartRequest;
  substitutedRequest: KickstartRequest;
}

/**
 * Resume information when resuming a failed kickstart
 */
export interface ResumeInfo {
  kickstartId: string;
  lastStepCompleted: number;
  totalSteps: number;
  failedStepId: string;
  failedAt: string;
}
