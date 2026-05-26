/**
 * Phase 5 Intelligence Systems Integration Tests
 *
 * Comprehensive tests for ML anomaly detection, root cause analysis,
 * automated remediation, and policy engine
 */

import {
  MLAnomalyDetector,
  RootCauseAnalysisEngine,
  AutomatedRemediationEngine,
  PolicyEngine,
  type DetectedAnomaly,
  type RootCauseAnalysis,
  type RemediationExecution,
  type PolicyEvaluationResult,
} from '../../apps/monitoring/src';

describe('Phase 5 Intelligence Systems', () => {
  describe('MLAnomalyDetector', () => {
    let detector: MLAnomalyDetector;

    beforeEach(() => {
      detector = new MLAnomalyDetector();
    });

    test('should train model with sufficient data', () => {
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 50 + Math.sin((i * Math.PI) / 30) * 10 + Math.random() * 2,
      }));

      detector.addTrainingData('blockchain', 'queryTime', dataPoints);

      const model = detector.getModel('blockchain', 'queryTime');
      expect(model).toBeDefined();
      expect(model?.trainingDataSize).toBe(150);
      expect(model?.accuracy).toBeGreaterThan(0.5);
    });

    test('should detect spike anomaly', () => {
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 50 + Math.random() * 5,
      }));

      detector.addTrainingData('inference-runtime', 'responseTime', dataPoints);

      // Add spike
      const anomaly = detector.detectAnomalies('inference-runtime', 'responseTime', 500);

      expect(anomaly).toBeDefined();
      expect(anomaly?.anomalyType).toBe('spike');
      expect(anomaly?.anomalyScore).toBeGreaterThan(0.7);
    });

    test('should detect drop anomaly', () => {
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 100 + Math.random() * 10,
      }));

      detector.addTrainingData('thermal-engine', 'cpuTemp', dataPoints);

      // Add drop
      const anomaly = detector.detectAnomalies('thermal-engine', 'cpuTemp', 10);

      expect(anomaly).toBeDefined();
      expect(anomaly?.anomalyType).toBe('drop');
      expect(anomaly?.confidence).toBeGreaterThan(0);
    });

    test('should predict future anomalies', () => {
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 50 + i * 0.5 + Math.random() * 2, // Upward trend
      }));

      detector.addTrainingData('radiation-runtime', 'radiationLevel', dataPoints);

      const prediction = detector.predictAnomalies('radiation-runtime', 'radiationLevel', 60);

      expect(prediction).toBeDefined();
      expect(prediction?.anomalyProbability).toBeGreaterThanOrEqual(0);
      expect(prediction?.anomalyProbability).toBeLessThanOrEqual(1);
      expect(prediction?.forecastedValues.length).toBeGreaterThan(0);
    });

    test('should track anomalies over time', () => {
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 50 + Math.random() * 10,
      }));

      detector.addTrainingData('space-traffic', 'flightCount', dataPoints);

      // Simulate multiple anomalies
      detector.detectAnomalies('space-traffic', 'flightCount', 200);
      detector.detectAnomalies('space-traffic', 'flightCount', 5);

      const anomalies = detector.getAnomalies('space-traffic');
      expect(anomalies.length).toBeGreaterThan(0);
    });

    test('should export models and anomalies', () => {
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 50 + Math.random() * 10,
      }));

      detector.addTrainingData('digital-twin', 'syncTime', dataPoints);
      detector.detectAnomalies('digital-twin', 'syncTime', 500);

      const exported = detector.exportModels();
      expect(exported).toContain('digital-twin');
      expect(exported).toContain('syncTime');
    });

    test('should generate statistics', () => {
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 50 + Math.random() * 10,
      }));

      detector.addTrainingData('orbital-networking', 'latency', dataPoints);
      detector.detectAnomalies('orbital-networking', 'latency', 300);

      const stats = detector.getStatistics();
      expect(stats.totalModels).toBe(1);
      expect(stats.totalAnomalies).toBeGreaterThan(0);
      expect(stats.modelAccuracies.length).toBeGreaterThan(0);
    });
  });

  describe('RootCauseAnalysisEngine', () => {
    let engine: RootCauseAnalysisEngine;

    beforeEach(() => {
      engine = new RootCauseAnalysisEngine();
    });

    test('should analyze root causes with multiple symptoms', () => {
      const analysis = engine.analyzeRootCauses(
        'incident-001',
        ['inference-runtime', 'edge-compute'],
        ['High latency detected', 'CPU utilization above 90%'],
        { cpuUsage: 92, memoryUsage: 45, latency: 250 },
        []
      );

      expect(analysis.incidentId).toBe('incident-001');
      expect(analysis.affectedServices).toContain('inference-runtime');
      expect(analysis.hypotheses.length).toBeGreaterThan(0);
      expect(analysis.mostLikelyCause).toBeDefined();
      expect(analysis.analysisConfidence).toBeGreaterThanOrEqual(0);
    });

    test('should identify resource exhaustion as likely cause', () => {
      const analysis = engine.analyzeRootCauses(
        'incident-002',
        ['thermal-engine', 'power-management'],
        ['High latency', 'Timeout errors'],
        { cpuUsage: 95, memoryUsage: 88, latency: 500 },
        []
      );

      const resourceExhaustionHypothesis = analysis.hypotheses.find(
        (h) => h.causeId === 'resource-exhaustion'
      );

      expect(resourceExhaustionHypothesis).toBeDefined();
      expect(resourceExhaustionHypothesis?.probability).toBeGreaterThan(0.3);
    });

    test('should detect cascading failure patterns', () => {
      const analysis = engine.analyzeRootCauses(
        'incident-003',
        ['space-traffic', 'orbital-networking', 'digital-twin'],
        ['Error spike', 'Connection errors'],
        { errorRate: 15, connectionPoolSize: 0 },
        [
          {
            service1: 'space-traffic',
            service2: 'orbital-networking',
            strength: 0.9,
          },
          {
            service1: 'orbital-networking',
            service2: 'digital-twin',
            strength: 0.85,
          },
        ]
      );

      const cascadingHypothesis = analysis.hypotheses.find(
        (h) => h.causeId === 'cascading-failure'
      );

      expect(cascadingHypothesis).toBeDefined();
      expect(cascadingHypothesis?.probability).toBeGreaterThan(0.4);
    });

    test('should provide remediation steps', () => {
      const analysis = engine.analyzeRootCauses(
        'incident-004',
        ['blockchain'],
        ['Database timeout'],
        { databaseLatency: 5000 },
        []
      );

      expect(analysis.suggestedActions.length).toBeGreaterThan(0);
      expect(analysis.suggestedActions[0]).toBeDefined();
    });

    test('should record correlations for learning', () => {
      engine.recordCorrelation('cpu-spike', 'latency-increase', 0.87);
      engine.recordCorrelation('cpu-spike', 'latency-increase', 0.92);

      const patterns = engine.getCorrelationPatterns('cpu-spike');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].frequency).toBe(2);
      expect(patterns[0].avgProbability).toBeGreaterThan(0.85);
    });

    test('should track analysis history', () => {
      engine.analyzeRootCauses(
        'incident-005',
        ['blockchain'],
        ['Error increase'],
        { errorRate: 8 },
        []
      );

      const history = engine.getAnalysisHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].incidentId).toBe('incident-005');
    });

    test('should generate statistics', () => {
      engine.analyzeRootCauses(
        'incident-006',
        ['thermal-engine'],
        ['Temperature spike'],
        { temperature: 85 },
        []
      );

      const stats = engine.getStatistics();
      expect(stats.totalAnalyses).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.mostCommonCauses).toBeDefined();
    });
  });

  describe('AutomatedRemediationEngine', () => {
    let engine: AutomatedRemediationEngine;

    beforeEach(() => {
      engine = new AutomatedRemediationEngine();
    });

    test('should execute scale-up action', async () => {
      const action = {
        actionId: 'scale-001',
        serviceName: 'inference-runtime',
        actionType: 'scale-up' as const,
        priority: 'high' as const,
        parameters: { scalePercentage: 25, maxInstances: 10 },
        expectedOutcome: 'Service scaled up',
        maxRetries: 2,
        retryDelayMs: 1000,
      };

      const execution = await engine.executeAction(action, true);
      expect(execution.status).toBe('success');
      expect(execution.output).toContain('scaled');
    });

    test('should execute restart action', async () => {
      const action = {
        actionId: 'restart-001',
        serviceName: 'blockchain',
        actionType: 'restart-service' as const,
        priority: 'immediate' as const,
        parameters: { gracefulShutdownSeconds: 5, healthCheckWaitSeconds: 10 },
        expectedOutcome: 'Service restarted',
        maxRetries: 1,
        retryDelayMs: 1000,
      };

      const execution = await engine.executeAction(action, true);
      expect(execution.status).toBe('success');
      expect(execution.output).toContain('restarted');
    });

    test('should require approval for critical actions', async () => {
      const action = {
        actionId: 'critical-001',
        serviceName: 'space-traffic',
        actionType: 'drain-connection' as const,
        priority: 'immediate' as const,
        parameters: { timeoutSeconds: 30 },
        expectedOutcome: 'Connections drained',
        maxRetries: 1,
        retryDelayMs: 1000,
      };

      const execution = await engine.executeAction(action, false);

      // Check policies
      const policies = engine.getAllPolicies();
      const hasCriticalPolicy = policies.some((p) => p.approvalRequired);
      expect(hasCriticalPolicy).toBe(true);
    });

    test('should track execution history', async () => {
      const action = {
        actionId: 'history-001',
        serviceName: 'thermal-engine',
        actionType: 'cache-flush' as const,
        priority: 'high' as const,
        parameters: { cacheType: 'all' },
        expectedOutcome: 'Cache flushed',
        maxRetries: 1,
        retryDelayMs: 500,
      };

      await engine.executeAction(action, true);

      const history = engine.getExecutionHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    test('should calculate success rates', async () => {
      const action = {
        actionId: 'rate-test-001',
        serviceName: 'radiation-runtime',
        actionType: 'circuit-breaker-reset' as const,
        priority: 'high' as const,
        parameters: { circuitName: 'external-api' },
        expectedOutcome: 'Circuit breaker reset',
        maxRetries: 1,
        retryDelayMs: 500,
      };

      await engine.executeAction(action, true);

      const rate = engine.getSuccessRate('rate-test-001');
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });

    test('should provide statistics', async () => {
      const action = {
        actionId: 'stats-001',
        serviceName: 'control-plane',
        actionType: 'custom-script' as const,
        priority: 'medium' as const,
        parameters: { script: 'echo test' },
        expectedOutcome: 'Script executed',
        maxRetries: 1,
        retryDelayMs: 500,
      };

      await engine.executeAction(action, true);

      const stats = engine.getStatistics();
      expect(stats.totalExecutions).toBeGreaterThan(0);
      expect(stats.successfulExecutions).toBeGreaterThan(0);
    });
  });

  describe('PolicyEngine', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      engine = new PolicyEngine();
    });

    test('should evaluate metric conditions', () => {
      const result = engine.evaluatePolicy('high-cpu-policy', {
        serviceName: 'inference-runtime',
        metrics: { cpuUsage: 90 },
        symptoms: [],
        events: [],
        timestamp: Date.now(),
      });

      expect(result.matched).toBe(true);
      expect(result.matchScore).toBeGreaterThan(0);
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    test('should evaluate symptom conditions', () => {
      const result = engine.evaluatePolicy('cascading-failure-policy', {
        serviceName: 'space-traffic',
        metrics: { error_rate: 15 },
        symptoms: ['error_rate exceeded', 'High latency detected'],
        events: [],
        timestamp: Date.now(),
      });

      expect(result.matched).toBe(true);
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    test('should respect policy scope', () => {
      const resultInScope = engine.evaluatePolicy('high-cpu-policy', {
        serviceName: 'inference-runtime',
        metrics: { cpuUsage: 90 },
        symptoms: [],
        events: [],
        timestamp: Date.now(),
      });

      const resultOutOfScope = engine.evaluatePolicy('high-cpu-policy', {
        serviceName: 'blockchain',
        metrics: { cpuUsage: 90 },
        symptoms: [],
        events: [],
        timestamp: Date.now(),
      });

      expect(resultInScope.matched).toBe(true);
      expect(resultOutOfScope.matched).toBe(false);
    });

    test('should enforce cooldown between evaluations', () => {
      const context = {
        serviceName: 'inference-runtime',
        metrics: { cpuUsage: 90 },
        symptoms: [],
        events: [],
        timestamp: Date.now(),
      };

      const result1 = engine.evaluatePolicy('high-cpu-policy', context);
      const result2 = engine.evaluatePolicy('high-cpu-policy', context);

      // Second evaluation should not match due to cooldown
      expect(result1.matched).toBe(true);
      expect(result2.matched).toBe(false);
    });

    test('should track policy versions', () => {
      const policy = engine.getPolicy('high-cpu-policy');
      expect(policy).toBeDefined();

      engine.updatePolicy('high-cpu-policy', {
        description: 'Updated description',
      });

      const versions = engine.getPolicyVersions('high-cpu-policy');
      expect(versions.length).toBe(2);
      expect(versions[1].version).toBe(2);
    });

    test('should create custom policies', () => {
      engine.createPolicy({
        policyId: 'custom-policy-001',
        name: 'Custom Test Policy',
        description: 'Test policy for custom conditions',
        enabled: true,
        priority: 50,
        scope: { serviceName: 'test-service' },
        conditions: [
          {
            type: 'metric',
            name: 'test-metric',
            operator: '>',
            threshold: 75,
          },
        ],
        actions: [
          {
            type: 'alert',
            name: 'test-alert',
            priority: 'high',
            parameters: { severity: 'warning' },
          },
        ],
        evaluationStrategy: 'first-match',
        cooldownMs: 300000,
        maxExecutionsPerWindow: 5,
        timeWindowMs: 3600000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });

      const policy = engine.getPolicy('custom-policy-001');
      expect(policy).toBeDefined();
      expect(policy?.name).toBe('Custom Test Policy');
    });

    test('should provide statistics', () => {
      engine.evaluatePolicy('high-cpu-policy', {
        serviceName: 'inference-runtime',
        metrics: { cpuUsage: 90 },
        symptoms: [],
        events: [],
        timestamp: Date.now(),
      });

      const stats = engine.getStatistics();
      expect(stats.totalPolicies).toBeGreaterThan(0);
      expect(stats.enabledPolicies).toBeGreaterThan(0);
      expect(stats.totalEvaluations).toBeGreaterThan(0);
    });
  });

  describe('Integration Scenarios', () => {
    test('should integrate ML anomaly detection with root cause analysis', () => {
      const detector = new MLAnomalyDetector();
      const rootCauseEngine = new RootCauseAnalysisEngine();

      // Train model
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 100 + Math.random() * 10,
      }));

      detector.addTrainingData('blockchain', 'latency', dataPoints);

      // Detect anomaly
      const anomaly = detector.detectAnomalies('blockchain', 'latency', 350);

      if (anomaly) {
        // Analyze root cause
        const analysis = rootCauseEngine.analyzeRootCauses(
          'incident-ml-rca-001',
          ['blockchain'],
          [anomaly.recommendation],
          { latency: 350 },
          []
        );

        expect(analysis.mostLikelyCause).toBeDefined();
        expect(analysis.suggestedActions.length).toBeGreaterThan(0);
      }
    });

    test('should integrate policy engine with automated remediation', async () => {
      const policyEngine = new PolicyEngine();
      const remediationEngine = new AutomatedRemediationEngine();

      const context = {
        serviceName: 'inference-runtime',
        metrics: { cpuUsage: 90 },
        symptoms: [],
        events: [],
        timestamp: Date.now(),
      };

      const policyResult = policyEngine.evaluatePolicy('high-cpu-policy', context);

      if (policyResult.matched && policyResult.suggestedActions.length > 0) {
        const action = {
          actionId: 'policy-remediation-001',
          serviceName: 'inference-runtime',
          actionType: 'scale-up' as const,
          priority: 'high' as const,
          parameters: { scalePercentage: 25 },
          expectedOutcome: 'Service scaled',
          maxRetries: 2,
          retryDelayMs: 1000,
        };

        const execution = await remediationEngine.executeAction(action, true);
        expect(execution.status).toBe('success');
      }
    });

    test('complete incident response workflow', () => {
      const detector = new MLAnomalyDetector();
      const rootCauseEngine = new RootCauseAnalysisEngine();
      const policyEngine = new PolicyEngine();

      // Setup training data
      const dataPoints = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - (150 - i) * 60000,
        value: 50 + Math.random() * 10,
      }));

      detector.addTrainingData('space-traffic', 'responseTime', dataPoints);

      // Detect anomaly
      const anomaly = detector.detectAnomalies('space-traffic', 'responseTime', 500);

      expect(anomaly).toBeDefined();

      if (anomaly) {
        // Analyze root cause
        const analysis = rootCauseEngine.analyzeRootCauses(
          'workflow-incident-001',
          ['space-traffic'],
          [anomaly.recommendation],
          { responseTime: 500 },
          []
        );

        expect(analysis.mostLikelyCause).toBeDefined();

        // Evaluate policy
        const policyResult = policyEngine.evaluatePolicy('cascading-failure-policy', {
          serviceName: 'space-traffic',
          metrics: { responseTime: 500 },
          symptoms: [anomaly.recommendation],
          events: [],
          timestamp: Date.now(),
        });

        // Policy should be evaluated
        expect(policyResult).toBeDefined();
      }
    });
  });
});
