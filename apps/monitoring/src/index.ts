/**
 * OrbitalMind Monitoring System
 *
 * Exports optimization monitoring, dashboard, and alerting capabilities
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
