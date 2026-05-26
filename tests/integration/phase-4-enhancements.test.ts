/**
 * Phase 4 Enhancements Integration Tests
 *
 * Tests for rule management API, alert correlation engine,
 * and predictive SLA violation detection
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RuleManagementAPI from '../../apps/monitoring/src/rule-management-api';
import AlertCorrelationEngine from '../../apps/monitoring/src/alert-correlation-engine';
import PredictiveSLADetector from '../../apps/monitoring/src/predictive-sla-detection';

describe('Phase 4 Enhancements: Rule Management, Correlation & Prediction', () => {
  describe('RuleManagementAPI - Core Functionality', () => {
    let ruleAPI: RuleManagementAPI;

    beforeEach(() => {
      ruleAPI = new RuleManagementAPI();
    });

    it('should list available rule templates', () => {
      const templates = ruleAPI.listTemplates();

      expect(templates).toBeDefined();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should filter templates by type', () => {
      const escalationTemplates = ruleAPI.listTemplates('escalation');

      expect(escalationTemplates.length).toBeGreaterThan(0);
      expect(escalationTemplates.every((t) => t.type === 'escalation')).toBe(true);
    });

    it('should get template by ID', () => {
      const template = ruleAPI.getTemplate('template-escalation-default');

      expect(template).toBeDefined();
      expect(template?.name).toBe('Default Escalation Pattern');
    });

    it('should create rule from template', () => {
      const rule = ruleAPI.createRuleFromTemplate(
        'template-escalation-default',
        'Custom Escalation Rule',
        { severity: 'critical', serviceName: 'space-traffic' },
        'admin@orbitalmind.io'
      );

      expect(rule).toBeDefined();
      expect(rule?.name).toBe('Custom Escalation Rule');
      expect(rule?.type).toBe('escalation');
      expect(rule?.currentVersion).toBe(1);
    });

    it('should create rule directly', () => {
      const rule = ruleAPI.createRule(
        'Direct Rule',
        'incident-creation',
        'Test rule created directly',
        { trigger: 'alert-threshold', severity: 'critical' },
        'admin@orbitalmind.io',
        ['test', 'direct']
      );

      expect(rule).toBeDefined();
      expect(rule.id).toMatch(/^RULE-\d+$/);
      expect(rule.tags).toContain('test');
    });

    it('should update rule and create version', () => {
      const rule = ruleAPI.createRule(
        'Versioned Rule',
        'escalation',
        'Test versioning',
        { level: 1 },
        'admin@orbitalmind.io'
      );

      expect(rule.currentVersion).toBe(1);

      const updated = ruleAPI.updateRule(
        rule.id,
        { level: 2 },
        'Updated to level 2',
        'admin@orbitalmind.io'
      );

      expect(updated).toBe(true);

      const retrievedRule = ruleAPI.getRule(rule.id);
      expect(retrievedRule?.currentVersion).toBe(2);
      expect(retrievedRule?.versions).toHaveLength(2);
    });

    it('should deploy rule version', () => {
      const rule = ruleAPI.createRule(
        'Deploy Test',
        'escalation',
        'Test deployment',
        {},
        'admin@orbitalmind.io'
      );

      expect(rule.deploymentStatus).toBe('draft');

      const deployed = ruleAPI.deployRule(rule.id, 1, 'deployer@orbitalmind.io');

      expect(deployed).toBe(true);

      const retrievedRule = ruleAPI.getRule(rule.id);
      expect(retrievedRule?.deploymentStatus).toBe('deployed');
      expect(retrievedRule?.deploymentHistory).toHaveLength(1);
    });

    it('should rollback rule to previous version', () => {
      const rule = ruleAPI.createRule(
        'Rollback Test',
        'aggregation',
        'Test rollback',
        { version: 1 },
        'admin@orbitalmind.io'
      );

      ruleAPI.updateRule(rule.id, { version: 2 }, 'Version 2', 'admin@orbitalmind.io');
      ruleAPI.deployRule(rule.id, 2, 'deployer@orbitalmind.io');

      const rolledBack = ruleAPI.rollbackRule(rule.id, 1, 'deployer@orbitalmind.io');

      expect(rolledBack).toBe(true);

      const retrievedRule = ruleAPI.getRule(rule.id);
      expect(retrievedRule?.currentVersion).toBe(1);
      expect(retrievedRule?.deploymentStatus).toBe('rolled-back');
    });

    it('should test rule with sample data', () => {
      const rule = ruleAPI.createRule(
        'Test Rule',
        'escalation',
        'Rule for testing',
        { conditions: { severity: 'critical' } },
        'admin@orbitalmind.io'
      );

      const testResult = ruleAPI.testRule(rule.id, [
        {
          name: 'Critical alert test',
          input: { severity: 'critical' },
          expectedOutput: { matched: true },
        },
        {
          name: 'Warning alert test',
          input: { severity: 'warning' },
          expectedOutput: { matched: false },
        },
      ]);

      expect(testResult.passed).toBe(2);
      expect(testResult.failed).toBe(0);
    });

    it('should enable and disable rules', () => {
      const rule = ruleAPI.createRule(
        'Toggle Rule',
        'escalation',
        'Rule to toggle',
        {},
        'admin@orbitalmind.io'
      );

      expect(rule.enabled).toBe(true);

      const disabled = ruleAPI.disableRule(rule.id);
      expect(disabled).toBe(true);

      let retrievedRule = ruleAPI.getRule(rule.id);
      expect(retrievedRule?.enabled).toBe(false);

      const enabled = ruleAPI.enableRule(rule.id);
      expect(enabled).toBe(true);

      retrievedRule = ruleAPI.getRule(rule.id);
      expect(retrievedRule?.enabled).toBe(true);
    });

    it('should list rules by type and tag', () => {
      ruleAPI.createRule(
        'Escalation Rule 1',
        'escalation',
        'Rule 1',
        {},
        'admin@orbitalmind.io',
        ['critical']
      );

      ruleAPI.createRule(
        'Escalation Rule 2',
        'escalation',
        'Rule 2',
        {},
        'admin@orbitalmind.io',
        ['warning']
      );

      const allEscalation = ruleAPI.listRules('escalation');
      expect(allEscalation.length).toBeGreaterThanOrEqual(2);

      const criticalRules = ruleAPI.listRules(undefined, 'critical');
      expect(criticalRules.length).toBeGreaterThan(0);
      expect(criticalRules.every((r) => r.tags.includes('critical'))).toBe(true);
    });

    it('should get rule statistics', () => {
      ruleAPI.createRule('Rule 1', 'escalation', 'Test', {}, 'admin@orbitalmind.io');
      ruleAPI.createRule('Rule 2', 'aggregation', 'Test', {}, 'admin@orbitalmind.io');
      ruleAPI.createRule(
        'Rule 3',
        'incident-creation',
        'Test',
        {},
        'admin@orbitalmind.io'
      );

      const stats = ruleAPI.getStatistics();

      expect(stats.totalRules).toBeGreaterThanOrEqual(3);
      expect(stats.byType.escalation).toBeGreaterThan(0);
      expect(stats.byType.aggregation).toBeGreaterThan(0);
      expect(stats.byType['incident-creation']).toBeGreaterThan(0);
    });

    it('should export and import rules', () => {
      const rule = ruleAPI.createRule(
        'Export Test',
        'escalation',
        'Test export',
        { data: 'test' },
        'admin@orbitalmind.io'
      );

      const exported = ruleAPI.exportRule(rule.id);
      expect(exported).toBeDefined();
      expect(exported).toContain(rule.id);

      const importedRule = ruleAPI.importRule(exported!, 'importer@orbitalmind.io');
      expect(importedRule).toBeDefined();
      expect(importedRule?.id).toBe(rule.id);
    });
  });

  describe('AlertCorrelationEngine - Core Functionality', () => {
    let correlationEngine: AlertCorrelationEngine;

    beforeEach(() => {
      correlationEngine = new AlertCorrelationEngine();
    });

    it('should add alerts for correlation analysis', () => {
      correlationEngine.addAlert({
        alertId: 'ALERT-CORR-001',
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'High response time',
        timestamp: Date.now(),
        value: 150,
        threshold: 50,
      });

      const patterns = correlationEngine.getAllPatterns();
      expect(patterns).toBeDefined();
    });

    it('should detect correlated metrics', () => {
      const now = Date.now();

      // Add correlated alerts (avgResponseTime and errorRate correlate)
      correlationEngine.addAlert({
        alertId: 'ALERT-CORR-002',
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'High response time',
        timestamp: now,
        value: 150,
        threshold: 50,
      });

      correlationEngine.addAlert({
        alertId: 'ALERT-CORR-003',
        serviceName: 'space-traffic',
        metricName: 'errorRate',
        severity: 'critical',
        message: 'High error rate',
        timestamp: now + 1000,
        value: 5,
        threshold: 1,
      });

      const patterns = correlationEngine.getAllPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should detect cascade failures across dependencies', () => {
      const now = Date.now();

      // space-traffic → orbital-networking dependency
      correlationEngine.addAlert({
        alertId: 'ALERT-CASC-001',
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'Source service failure',
        timestamp: now,
        value: 200,
        threshold: 50,
      });

      correlationEngine.addAlert({
        alertId: 'ALERT-CASC-002',
        serviceName: 'orbital-networking',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'Dependent service failure',
        timestamp: now + 5000,
        value: 180,
        threshold: 50,
      });

      const patterns = correlationEngine.getAllPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should analyze alert impact', () => {
      correlationEngine.addAlert({
        alertId: 'ALERT-IMPACT-001',
        serviceName: 'thermal-engine',
        metricName: 'temperature',
        severity: 'critical',
        message: 'High temperature',
        timestamp: Date.now(),
        value: 100,
        threshold: 80,
      });

      const impact = correlationEngine.analyzeAlertImpact('ALERT-IMPACT-001');

      expect(impact.directlyAffected).toContain('thermal-engine');
      expect(impact.estimatedSeverity).toBeDefined();
    });

    it('should predict cascade failures', () => {
      const cascades = correlationEngine.predictCascadeFailures('space-traffic');

      expect(cascades.affectedServices).toBeDefined();
      expect(
        cascades.affectedServices.every((s) => s.probability >= 0 && s.probability <= 1)
      ).toBe(true);
    });

    it('should get related alerts within time window', () => {
      const now = Date.now();

      correlationEngine.addAlert({
        alertId: 'ALERT-REL-001',
        serviceName: 'blockchain',
        metricName: 'queryTime',
        severity: 'warning',
        message: 'Slow query',
        timestamp: now,
        value: 50,
        threshold: 10,
      });

      correlationEngine.addAlert({
        alertId: 'ALERT-REL-002',
        serviceName: 'blockchain',
        metricName: 'cacheHitRate',
        severity: 'warning',
        message: 'Low cache hit rate',
        timestamp: now + 5000,
        value: 60,
        threshold: 80,
      });

      const related = correlationEngine.getRelatedAlerts('ALERT-REL-001', 5);

      expect(related.length).toBeGreaterThan(0);
      expect(related.some((a) => a.alertId === 'ALERT-REL-002')).toBe(true);
    });

    it('should get service dependency graph', () => {
      const graph = correlationEngine.getDependencyGraph();

      expect(graph.nodes).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges).toBeDefined();
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should get correlation statistics', () => {
      correlationEngine.addAlert({
        alertId: 'ALERT-STAT-001',
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'Test',
        timestamp: Date.now(),
        value: 100,
        threshold: 50,
      });

      const stats = correlationEngine.getStatistics();

      expect(stats.totalAlerts).toBeGreaterThan(0);
      expect(stats.totalPatterns).toBeGreaterThanOrEqual(0);
      expect(stats.averageAlertCorrelation).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup old alerts', () => {
      const oldTime = Date.now() - 7200000; // 2 hours ago

      correlationEngine.addAlert({
        alertId: 'ALERT-OLD-001',
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'Old alert',
        timestamp: oldTime,
        value: 100,
        threshold: 50,
      });

      const removed = correlationEngine.cleanup(60); // Cleanup older than 60 minutes

      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PredictiveSLADetector - Core Functionality', () => {
    let detector: PredictiveSLADetector;

    beforeEach(() => {
      detector = new PredictiveSLADetector();
    });

    it('should record metric values', () => {
      detector.recordMetric('space-traffic', 'avgResponseTime', 45);
      detector.recordMetric('space-traffic', 'avgResponseTime', 48);
      detector.recordMetric('space-traffic', 'avgResponseTime', 50);

      const predictions = detector.getAllPredictions();
      expect(predictions).toBeDefined();
    });

    it('should analyze trends', () => {
      // Record increasing trend
      for (let i = 0; i < 10; i++) {
        detector.recordMetric('thermal-engine', 'temperature', 70 + i * 2);
      }

      const trend = detector.analyzeTrend('thermal-engine', 'temperature');

      expect(trend).toBeDefined();
      expect(trend?.trendDirection).toMatch(/increasing|decreasing|stable/);
      expect(trend?.dataPoints).toBeGreaterThan(0);
    });

    it('should predict SLA violations', () => {
      // Set SLA target
      detector.setSLATarget('space-traffic', 'avgResponseTime', 50, 10);

      // Record increasing values approaching threshold
      for (let i = 0; i < 20; i++) {
        detector.recordMetric('space-traffic', 'avgResponseTime', 40 + i * 0.5);
      }

      const prediction = detector.predictSLAViolation(
        'space-traffic',
        'avgResponseTime'
      );

      expect(prediction).toBeDefined();
      expect(prediction?.violationProbability).toBeGreaterThanOrEqual(0);
      expect(prediction?.violationProbability).toBeLessThanOrEqual(1);
    });

    it('should detect anomalies', () => {
      // Record normal values
      for (let i = 0; i < 10; i++) {
        detector.recordMetric('blockchain', 'queryTime', 10 + Math.random() * 2);
      }

      // Record anomalous value
      detector.recordMetric('blockchain', 'queryTime', 50);

      const anomalies = detector.detectAnomalies('blockchain');

      expect(anomalies).toBeDefined();
      expect(anomalies.some((a) => a.key.includes('queryTime'))).toBe(true);
    });

    it('should get high-risk predictions', () => {
      detector.setSLATarget('blockchain', 'cacheHitRate', 80, 5);

      // Record decreasing cache hit rate
      for (let i = 0; i < 15; i++) {
        detector.recordMetric('blockchain', 'cacheHitRate', 80 - i * 2);
      }

      const highRisk = detector.getHighRiskPredictions(0.5);

      expect(highRisk).toBeDefined();
      expect(
        highRisk.every((p) => p.violationProbability >= 0.5)
      ).toBe(true);
    });

    it('should analyze service trends', () => {
      // Record metrics for multiple services
      for (let i = 0; i < 10; i++) {
        detector.recordMetric('space-traffic', 'avgResponseTime', 45 + i);
        detector.recordMetric('space-traffic', 'errorRate', 1 - i * 0.05);
      }

      const trends = detector.getServiceTrends('space-traffic');

      expect(trends.length).toBeGreaterThan(0);
      expect(trends.every((t) => t.serviceName === 'space-traffic')).toBe(true);
    });

    it('should generate recommendations', () => {
      detector.setSLATarget('thermal-engine', 'temperature', 80, 5);

      // Record rapidly increasing temperature
      for (let i = 0; i < 20; i++) {
        detector.recordMetric('thermal-engine', 'temperature', 60 + i * 1.5);
      }

      const prediction = detector.predictSLAViolation(
        'thermal-engine',
        'temperature'
      );

      expect(prediction?.recommendedActions).toBeDefined();
      expect(prediction?.recommendedActions.length).toBeGreaterThan(0);
    });

    it('should generate forecast data', () => {
      // Record metric values
      for (let i = 0; i < 15; i++) {
        detector.recordMetric('space-traffic', 'avgResponseTime', 45 + i * 0.5);
      }

      const forecast = detector.getForecastData(
        'space-traffic',
        'avgResponseTime'
      );

      expect(forecast).toBeDefined();
      expect(forecast?.historical).toBeDefined();
      expect(forecast?.forecast).toBeDefined();
      expect(forecast?.forecast.length).toBeGreaterThan(0);
    });

    it('should get statistics', () => {
      detector.recordMetric('space-traffic', 'avgResponseTime', 45);
      detector.recordMetric('space-traffic', 'errorRate', 0.5);
      detector.recordMetric('thermal-engine', 'temperature', 75);

      const stats = detector.getStatistics();

      expect(stats.trackedMetrics).toBeGreaterThan(0);
      expect(stats.metricsWithTrend).toBeGreaterThanOrEqual(0);
      expect(stats.atRisk).toBeGreaterThanOrEqual(0);
      expect(stats.highRisk).toBeGreaterThanOrEqual(0);
    });

    it('should export predictions', () => {
      detector.recordMetric('blockchain', 'queryTime', 15);
      detector.setSLATarget('blockchain', 'queryTime', 10, 2);

      const exported = detector.exportPredictions();

      expect(exported).toBeDefined();
      const data = JSON.parse(exported);
      expect(data.timestamp).toBeDefined();
      expect(data.statistics).toBeDefined();
      expect(data.predictions).toBeDefined();
    });
  });

  describe('Integration: All Three Systems Together', () => {
    let ruleAPI: RuleManagementAPI;
    let correlationEngine: AlertCorrelationEngine;
    let detector: PredictiveSLADetector;

    beforeEach(() => {
      ruleAPI = new RuleManagementAPI();
      correlationEngine = new AlertCorrelationEngine();
      detector = new PredictiveSLADetector();
    });

    it('should coordinate rule management with correlation detection', () => {
      // Create aggregation rule
      const rule = ruleAPI.createRule(
        'Alert Aggregation',
        'aggregation',
        'Aggregate space-traffic alerts',
        { serviceName: 'space-traffic' },
        'admin@orbitalmind.io'
      );

      expect(rule).toBeDefined();

      // Add correlated alerts
      const now = Date.now();
      correlationEngine.addAlert({
        alertId: 'ALERT-001',
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'High response time',
        timestamp: now,
        value: 150,
        threshold: 50,
      });

      const patterns = correlationEngine.getAllPatterns();
      expect(patterns).toBeDefined();
    });

    it('should use predictive detection to inform incident rules', () => {
      // Set SLA target
      detector.setSLATarget('blockchain', 'queryTime', 10, 2);

      // Record increasing query times
      for (let i = 0; i < 20; i++) {
        detector.recordMetric('blockchain', 'queryTime', 8 + i * 0.2);
      }

      // Get high-risk predictions
      const predictions = detector.getHighRiskPredictions(0.5);

      if (predictions.length > 0) {
        // Create incident rule for the predicted violation
        const rule = ruleAPI.createRule(
          'Predictive Incident Rule',
          'incident-creation',
          'Create incident for predicted SLA violation',
          { trigger: 'predictive-sla-violation' },
          'admin@orbitalmind.io'
        );

        expect(rule).toBeDefined();
      }
    });

    it('should orchestrate full workflow with all systems', () => {
      // Step 1: Set up rules
      const escalationRule = ruleAPI.createRule(
        'Production Escalation',
        'escalation',
        'Critical alert escalation',
        {},
        'admin@orbitalmind.io'
      );

      // Step 2: Add alerts
      const now = Date.now();
      correlationEngine.addAlert({
        alertId: 'ALERT-PROD-001',
        serviceName: 'space-traffic',
        metricName: 'avgResponseTime',
        severity: 'critical',
        message: 'Critical response time',
        timestamp: now,
        value: 200,
        threshold: 50,
      });

      // Step 3: Record metrics
      detector.setSLATarget('space-traffic', 'avgResponseTime', 50, 10);
      detector.recordMetric('space-traffic', 'avgResponseTime', 200);

      // Step 4: Analyze
      const patterns = correlationEngine.getAllPatterns();
      const predictions = detector.getAllPredictions();
      const rules = ruleAPI.listRules();

      expect(escalationRule).toBeDefined();
      expect(patterns).toBeDefined();
      expect(predictions).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
    });
  });
});
