/**
 * OrbitalMind Monitoring API Client
 *
 * Client library for services to submit metrics and retrieve monitoring data
 */

/**
 * HTTP client options
 */
export interface ClientOptions {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Monitoring API Client
 */
export class MonitoringAPIClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private headers: Record<string, string>;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl;
    this.timeout = options.timeout || 5000;
    this.retries = options.retries || 3;
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: this.headers,
      timeout: this.timeout,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retries) {
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error('Unknown error');
  }

  /**
   * Check server health
   */
  async health(): Promise<{ status: string; timestamp: number }> {
    return this.request('GET', '/health');
  }

  /**
   * Record single metric
   */
  async recordMetric(
    serviceName: string,
    metricName: string,
    value: number,
    options?: { unit?: string; threshold?: number }
  ): Promise<any> {
    return this.request('POST', '/api/metrics/record', {
      serviceName,
      metricName,
      value,
      ...options,
    });
  }

  /**
   * Record batch of metrics
   */
  async recordMetrics(
    serviceName: string,
    metrics: Array<{ name: string; value: number; unit?: string; threshold?: number }>
  ): Promise<any> {
    return this.request('POST', '/api/metrics/batch', {
      serviceName,
      metrics,
    });
  }

  /**
   * Get service metrics
   */
  async getServiceMetrics(serviceName: string, metricName?: string): Promise<any> {
    let path = `/api/metrics/${serviceName}`;
    if (metricName) {
      path += `?metricName=${encodeURIComponent(metricName)}`;
    }
    return this.request('GET', path);
  }

  /**
   * Update service health
   */
  async updateHealth(
    serviceName: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    options?: { uptime?: number; averageLatency?: number; errorRate?: number }
  ): Promise<any> {
    return this.request('POST', '/api/health/update', {
      serviceName,
      status,
      ...options,
    });
  }

  /**
   * Get service health
   */
  async getHealth(serviceName: string): Promise<any> {
    return this.request('GET', `/api/health/${serviceName}`);
  }

  /**
   * Get all service health
   */
  async getAllHealth(): Promise<any> {
    return this.request('GET', '/api/health');
  }

  /**
   * Get active alerts
   */
  async getAlerts(serviceName?: string, severity?: string): Promise<any> {
    let path = '/api/alerts';
    const params = new URLSearchParams();

    if (serviceName) params.append('serviceName', serviceName);
    if (severity) params.append('severity', severity);

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    return this.request('GET', path);
  }

  /**
   * Get service alerts
   */
  async getServiceAlerts(serviceName: string): Promise<any> {
    return this.request('GET', `/api/alerts/${serviceName}`);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<any> {
    return this.request('POST', `/api/alerts/${alertId}/resolve`);
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(): Promise<any> {
    return this.request('GET', '/api/dashboard/summary');
  }

  /**
   * Get dashboard HTML
   */
  async getDashboardHTML(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/dashboard/html`, {
      method: 'GET',
      headers: this.headers,
      timeout: this.timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Get dashboard metrics as JSON
   */
  async getDashboardJSON(): Promise<any> {
    return this.request('GET', '/api/dashboard/metrics.json');
  }

  /**
   * Download dashboard metrics as CSV
   */
  async getDashboardCSV(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/dashboard/metrics.csv`, {
      method: 'GET',
      headers: this.headers,
      timeout: this.timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Get service statistics
   */
  async getStatistics(serviceName: string): Promise<any> {
    return this.request('GET', `/api/statistics/${serviceName}`);
  }

  /**
   * Get optimization summary
   */
  async getOptimizationSummary(): Promise<any> {
    return this.request('GET', '/api/optimization/summary');
  }
}

/**
 * Create API client
 */
export function createMonitoringClient(baseUrl: string, options?: Partial<ClientOptions>): MonitoringAPIClient {
  return new MonitoringAPIClient({
    baseUrl,
    ...options,
  });
}

export default MonitoringAPIClient;
