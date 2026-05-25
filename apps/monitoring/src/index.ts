/**
 * OrbitalMind Monitoring System
 *
 * Exports optimization monitoring, dashboard, alerting, and API capabilities
 */

export { default as OptimizationMonitor } from './optimization-monitor';
export type {
  PerformanceMetric,
  ServiceHealth,
  PerformanceAlert,
  ServiceOptimizationMetrics,
} from './optimization-monitor';

export { default as OptimizationDashboardUI } from './dashboard-ui';
export type {
  DashboardMetric,
  ServiceCard,
  AlertSummary,
} from './dashboard-ui';

export { default as DashboardGenerator } from './dashboard-generator';

export { default as AlertNotificationManager } from './alerting-system';
export {
  ConsoleAlertHandler,
  FileAlertHandler,
  EmailAlertHandler,
  WebhookAlertHandler,
  SlackAlertHandler,
} from './alerting-system';
export type {
  AlertNotificationHandler,
  AlertNotificationConfig,
} from './alerting-system';

export { default as MetricsCollector } from './metrics-collector';
export type {
  MetricBatch,
  ServiceMetrics,
} from './metrics-collector';

export { default as MonitoringAPIServer } from './monitoring-api';

export { default as MonitoringAPIClient, createMonitoringClient } from './api-client';
export type {
  ClientOptions,
} from './api-client';
