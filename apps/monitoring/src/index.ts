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

export { default as PerformanceBenchmark, OptimizationBenchmarkSuite } from './performance-benchmarks';
export type {
  BenchmarkResult,
  BenchmarkConfig,
} from './performance-benchmarks';

export {
  SpaceTrafficServiceMonitor,
  DigitalTwinServiceMonitor,
  OrbitalNetworkingServiceMonitor,
  ThermalEngineServiceMonitor,
  ScienceOpsServiceMonitor,
  BlockchainServiceMonitor,
  AttitudeDeterminationServiceMonitor,
  PropulsionSystemServiceMonitor,
  CommunicationSystemServiceMonitor,
  PowerManagementServiceMonitor,
  SensorIntegrationServiceMonitor,
  AutonomousNavigationServiceMonitor,
} from './service-integration-examples';

export { default as SLATracker } from './sla-tracker';
export type {
  SLATarget,
  SLAMeasurement,
  SLACompliance,
  SLAViolation,
} from './sla-tracker';

export { default as AlertAggregator } from './alert-aggregation';
export type {
  AlertSignature,
  AggregatedAlert,
  AggregationRule,
  AggregationStats,
} from './alert-aggregation';

export { default as AlertEscalationManager } from './alert-escalation';
export type {
  EscalationPolicy,
  AlertEscalationState,
  EscalationLevel,
} from './alert-escalation';

export { default as IncidentResponseManager } from './incident-response';
export type {
  IncidentTicket,
  IncidentCreationRule,
  IncidentSeverity,
  IncidentStatus,
} from './incident-response';

export { default as RuleManagementAPI } from './rule-management-api';
export type {
  RuleType,
  RuleVersion,
  ManagedRule,
  RuleTemplate,
} from './rule-management-api';

export { default as AlertCorrelationEngine } from './alert-correlation-engine';
export type {
  CorrelationAlert,
  CorrelationPattern,
  ServiceDependency,
  MetricCorrelation,
} from './alert-correlation-engine';

export { default as PredictiveSLADetector } from './predictive-sla-detection';
export type {
  MetricDataPoint,
  TrendAnalysis,
  SLAViolationPrediction,
} from './predictive-sla-detection';

export { default as AdvancedAnalyticsDashboard } from './advanced-analytics-dashboard';
export type {
  DashboardMetric,
  DashboardAlert,
  ServiceHealthCard,
  RealtimeEvent,
  PerformanceTrend,
} from './advanced-analytics-dashboard';

export { default as MLAnomalyDetector } from './ml-anomaly-detection';
export type {
  TrainingDataPoint,
  AnomalyModel,
  DetectedAnomaly,
  AnomalyPrediction,
} from './ml-anomaly-detection';

export { default as RootCauseAnalysisEngine } from './root-cause-analysis';
export type {
  RootCauseHypothesis,
  RootCauseAnalysis,
  ServiceComponent,
} from './root-cause-analysis';

export { default as AutomatedRemediationEngine } from './automated-remediation';
export type {
  RemediationAction,
  RemediationExecution,
  RemediationPolicy,
} from './automated-remediation';

export { default as PolicyEngine } from './policy-engine';
export type {
  PolicyCondition,
  PolicyAction,
  Policy,
  EvaluationContext,
  PolicyEvaluationResult,
} from './policy-engine';
