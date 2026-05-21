/**
 * HTTP Request Execution Engine for FusionAuth CLI Apply command
 * Handles HTTP communication with FusionAuth API
 */

import { HTTPResponse, ParsedStep, TimeoutConfig } from './types.js';

/**
 * Default timeout configuration
 */
const DEFAULT_TIMEOUTS: TimeoutConfig = {
  connectTimeoutMs: 5000,
  readTimeoutMs: 30000,
};

/**
 * HTTP Client for executing kickstart requests
 */
export class HTTPClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutConfig: TimeoutConfig;

  /**
   * Initialize HTTP client
   * @param baseUrl Base URL of FusionAuth instance (e.g., https://auth.example.com)
   * @param apiKey API key for authorization
   * @param timeoutConfig Optional timeout configuration
   */
  constructor(
    baseUrl: string,
    apiKey: string,
    timeoutConfig?: Partial<TimeoutConfig>
  ) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.apiKey = apiKey;
    this.timeoutConfig = {
      ...DEFAULT_TIMEOUTS,
      ...timeoutConfig,
    };
  }

  /**
   * Wait for FusionAuth server to be ready
   * Polls /api/status endpoint until it returns JSON response
   * @param maxAttempts Maximum number of attempts (default: 30)
   * @param delayMs Delay between attempts in milliseconds (default: 4000)
   * @returns true if server is ready, throws error if timeout
   */
  public async waitForServerReady(
    maxAttempts: number = 30,
    delayMs: number = 4000
  ): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.executeRequest(
          'GET',
          '/api/status',
          undefined,
          undefined,
          undefined,
          { connectTimeoutMs: 5000, readTimeoutMs: 5000 }
        );

        // Check if response is JSON (not maintenance mode or proxy error)
        const contentType = response.contentType || 'application/json';
        if (
          response.status === 200 &&
          contentType.toLowerCase().includes('application/json')
        ) {
          return true;
        }
      } catch (err) {
        // Ignore errors, will retry
      }

      // Wait before next attempt (except on last attempt)
      if (attempt < maxAttempts - 1) {
        await this.sleep(delayMs);
      }
    }

    throw new Error(
      `Server failed to become ready after ${maxAttempts} attempts`
    );
  }

  /**
   * Execute an HTTP request to FusionAuth API
   * @param method HTTP method (POST, PATCH, PUT)
   * @param path API path (e.g., /api/tenant/{id})
   * @param body Request body object
   * @param tenantId Optional tenant ID for X-FusionAuth-TenantId header
   * @param contentType Optional content-type override
   * @param customTimeouts Optional custom timeout settings
   * @returns HTTPResponse with status, headers, and body
   */
  public async executeRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    tenantId?: string,
    contentType?: string,
    customTimeouts?: Partial<TimeoutConfig>
  ): Promise<HTTPResponse> {
    // Ensure path starts with a slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}${normalizedPath}`;
    const timeouts = { ...this.timeoutConfig, ...customTimeouts };

    const headers = this.buildHeaders(tenantId, contentType);
    const bodyStr = body ? JSON.stringify(body) : undefined;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        timeouts.readTimeoutMs
      );

      const response = await fetch(url, {
        method,
        headers,
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseHeaders = this.parseHeaders(response.headers);
      const responseContentType =
        response.headers.get('content-type') || 'application/json';
      const responseBody = await this.parseResponseBody(response);

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        contentType: responseContentType,
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(
            `Request timeout after ${timeouts.readTimeoutMs}ms: ${method} ${path}`
          );
        }
        throw new Error(`Request failed: ${err.message}`);
      }
      throw new Error(`Request failed: ${String(err)}`);
    }
  }

  /**
   * Execute a DELETE request
   * @param path API path
   * @param tenantId Optional tenant ID
   * @returns HTTPResponse
   */
  public async executeDelete(
    path: string,
    tenantId?: string
  ): Promise<HTTPResponse> {
    return this.executeRequest('DELETE', path, undefined, tenantId);
  }

  /**
   * Check if a resource exists at the given path
   * @param path API path
   * @param tenantId Optional tenant ID
   * @returns true if resource exists (status 2xx or 3xx), false otherwise
   */
  public async resourceExists(
    path: string,
    tenantId?: string
  ): Promise<boolean> {
    try {
      const response = await this.executeRequest(
        'GET',
        path,
        undefined,
        tenantId,
        undefined,
        { readTimeoutMs: 5000 }
      );
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  }

  /**
   * Build request headers for API call
   * @param tenantId Optional tenant ID
   * @param contentType Optional content-type override
   * @returns Headers object
   */
  private buildHeaders(
    tenantId?: string,
    contentType?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': this.apiKey,
      'Content-Type': contentType || 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'FusionAuth-CLI-Kickstart/1.0',
    };

    if (tenantId) {
      headers['X-FusionAuth-TenantId'] = tenantId;
    }

    return headers;
  }

  /**
   * Parse response headers into a simple object
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }

  /**
   * Parse response body based on content-type
   */
  private async parseResponseBody(
    response: Response
  ): Promise<Record<string, unknown> | string> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        return (await response.json()) as Record<string, unknown>;
      } catch {
        return await response.text();
      }
    }

    return await response.text();
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format a request for logging
   */
  public formatRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    tenantId?: string
  ): string {
    const url = `${this.baseUrl}${path}`;
    const tenantInfo = tenantId ? ` [tenant: ${tenantId}]` : '';
    const bodyInfo = body ? ` (${JSON.stringify(body).length} bytes)` : '';
    return `${method} ${url}${tenantInfo}${bodyInfo}`;
  }

  /**
   * Format a response for logging
   */
  public formatResponse(response: HTTPResponse): string {
    const statusInfo = `${response.status} ${response.statusText}`;
    const bodySize =
      typeof response.body === 'string'
        ? response.body.length
        : JSON.stringify(response.body).length;
    return `${statusInfo} (${bodySize} bytes)`;
  }
}

/**
 * Helper class for managing request execution with step tracking
 */
export class StepExecutor {
  constructor(private httpClient: HTTPClient) {}

  /**
   * Execute a single step and track metrics
   * @param step The parsed step to execute
   * @returns Execution result with response and timing
   */
  public async executeStep(step: ParsedStep): Promise<{
    response: HTTPResponse;
    durationMs: number;
  }> {
    const startTime = Date.now();

    const response = await this.httpClient.executeRequest(
      step.substitutedRequest.method,
      step.substitutedRequest.url,
      step.substitutedRequest.body,
      step.substitutedRequest.tenantId,
      step.substitutedRequest.contentType
    );

    const durationMs = Date.now() - startTime;

    return { response, durationMs };
  }

  /**
   * Check if response indicates success
   */
  public isSuccessResponse(response: HTTPResponse): boolean {
    return response.status >= 200 && response.status < 300;
  }

  /**
   * Extract error details from response
   */
  public extractErrorDetails(response: HTTPResponse): {
    category: string;
    message: string;
  } {
    const statusCode = response.status;
    let category = 'unknown_error';
    let message = `HTTP ${statusCode} ${response.statusText}`;

    switch (statusCode) {
      case 400:
        category = 'invalid_payload';
        break;
      case 401:
      case 403:
        category = 'authentication_failed';
        break;
      case 404:
        category = 'not_found';
        break;
      case 409:
        category = 'resource_conflict';
        break;
      case 500:
      case 502:
      case 503:
        category = 'server_error';
        break;
      default:
        break;
    }

    // Try to extract error message from response body
    if (typeof response.body === 'object' && response.body !== null) {
      const body = response.body as Record<string, unknown>;
      if (body.generalErrors && Array.isArray(body.generalErrors)) {
        const errors = body.generalErrors as string[];
        if (errors.length > 0) {
          message = errors[0];
        }
      } else if (body.fieldErrors && typeof body.fieldErrors === 'object') {
        const fieldErrors = body.fieldErrors as Record<string, string[]>;
        const firstField = Object.keys(fieldErrors)[0];
        if (firstField && fieldErrors[firstField]) {
          message = `${firstField}: ${fieldErrors[firstField][0]}`;
        }
      } else if (body.message && typeof body.message === 'string') {
        message = body.message;
      }
    }

    return { category, message };
  }
}
