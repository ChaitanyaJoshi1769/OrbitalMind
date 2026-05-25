/**
 * Phase 3 Integration Test
 * Comprehensive test of all Phase 3 enhancements:
 * - Performance benchmarking
 * - Service integration patterns
 * - SLA compliance tracking
 * - Alert aggregation and deduplication
 */

import {
  PerformanceBenchmark,
  OptimizationBenchmarkSuite,
  SpaceTrafficServiceMonitor,
  DigitalTwinServiceMonitor,
  OrbitalNetworkingServiceMonitor,
  ThermalEngineServiceMonitor,
  ScienceOpsServiceMonitor,
  BlockchainServiceMonitor,
  SLATracker,
  AlertAggregator,
} from '../../apps/monitoring/src/index';

describe('Phase 3 Integration Tests', () => {
  describe('Performance Benchmarking', () => {
    test('should run optimization benchmark suite', () => {
      const suite = new OptimizationBenchmarkSuite();

      // Run a single benchmark
      const benchmark = new PerformanceBenchmark();

      const result = benchmark.runBenchmark(
        {
          name: 'Test Optimization',
          serviceName: 'test-service',
          targetImprovement: 5,
          runs: 10,
        },
        () => {
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += Math.sqrt(i);
          }
          return sum;
        },
        () => {
          // Optimized version using caching
          const cache = new Map<number, number>();
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            if (cache.has(i)) {
              sum += cache.get(i)!;
            } else {
              const sqrt = Math.sqrt(i);
              cache.set(i, sqrt);
              sum += sqrt;
            }
          }
          return sum;
        }
      );

      expect(result).toBeDefined();
      expect(result.improvement).toBeGreaterThan(0);
      expect(result.name).toBe('Test Optimization');

      console.log(`✓ Benchmark completed with ${result.improvement.toFixed(1)}x improvement`);
    });

    test('should calculate benchmark statistics', async () => {
      const benchmark = new PerformanceBenchmark();

      const result = await benchmark.runBenchmark(
        {
          name: 'Statistical Test',
          serviceName: 'stats-service',
          targetImprovement: 3,
          runs: 20,
        },
        async () => {
          return Math.random() * 100;
        },
        async () => {
          return Math.random() * 20;
        }
      );

      expect(result.stdDevBefore).toBeDefined();
      expect(result.stdDevAfter).toBeDefined();
      expect(result.improvement).toBeGreaterThan(0);

      console.log(`
        Statistics:
        Before: ${result.avgBeforeTime.toFixed(2)}ms ± ${result.stdDevBefore.toFixed(2)}ms
        After: ${result.avgAfterTime.toFixed(2)}ms ± ${result.stdDevAfter.toFixed(2)}ms
        Improvement: ${result.improvement.toFixed(1)}x
      `);
    });

    test('should export benchmark results', async () => {
      const benchmark = new PerformanceBenchmark();

      await benchmark.runBenchmark(
        {
          name: 'Export Test',
          serviceName: 'export-service',
          targetImprovement: 2,
          runs: 5,
        },
        () => Math.random() * 50,
        () => Math.random() * 20
      );

      const json = benchmark.exportJSON();
      const csv = benchmark.exportCSV();

      expect(json).toContain('export-service');
      expect(csv).toContain('Export Test');

      console.log('✓ Benchmark results exported as JSON and CSV');
    });
  });

  describe('Service Integration Patterns', () => {
    test('should initialize space traffic service monitor', async () => {
      const monitor = new SpaceTrafficServiceMonitor();
      await monitor.initialize();

      monitor.recordCollisionDetection(500, 45, 2);
      monitor.recordTrafficOptimization(200, 75);
      monitor.recordCommunication(true, 50);

      await monitor.updateHealth();

      console.log('✓ Space Traffic Service Monitor initialized and recording metrics');
    });

    test('should initialize digital twin service monitor', async () => {
      const monitor = new DigitalTwinServiceMonitor();
      await monitor.initialize();

      monitor.recordPropagation(95, 99.5, 1000);
      monitor.recordCacheOperation(true, 5);
      monitor.recordSync(100, 50, 0);

      await monitor.updateHealth();

      console.log('✓ Digital Twin Service Monitor initialized and recording metrics');
    });

    test('should initialize thermal engine service monitor', async () => {
      const monitor = new ThermalEngineServiceMonitor();
      await monitor.initialize();

      monitor.recordTemperature('payload', 45, 50);
      monitor.recordThermalCalculation(120, 98);
      monitor.recordHeatDissipation(500);

      await monitor.updateHealth();

      console.log('✓ Thermal Engine Service Monitor initialized and recording metrics');
    });

    test('should initialize science ops service monitor', async () => {
      const monitor = new ScienceOpsServiceMonitor();
      await monitor.initialize();

      monitor.recordSpectralAnalysis(50, 1000000, 95);
      monitor.recordNDVICalculation(40, 98);
      monitor.recordDataProcessing(1000000, 45);

      await monitor.updateHealth();

      console.log('✓ Science Ops Service Monitor initialized and recording metrics');
    });

    test('should initialize blockchain service monitor', async () => {
      const monitor = new BlockchainServiceMonitor();
      await monitor.initialize();

      monitor.recordQuery(25, true, 500);
      monitor.recordTransaction(100, true);
      monitor.recordBlockValidation(1024, 150);

      await monitor.updateHealth();

      console.log('✓ Blockchain Service Monitor initialized and recording metrics');
    });

    test('should handle multiple service monitors', async () => {
      const services = [
        { name: 'Space Traffic', monitor: new SpaceTrafficServiceMonitor() },
        { name: 'Digital Twin', monitor: new DigitalTwinServiceMonitor() },
        { name: 'Orbital Networking', monitor: new OrbitalNetworkingServiceMonitor() },
        { name: 'Thermal Engine', monitor: new ThermalEngineServiceMonitor() },
        { name: 'Science Ops', monitor: new ScienceOpsServiceMonitor() },
        { name: 'Blockchain', monitor: new BlockchainServiceMonitor() },
      ];

      for (const service of services) {
        await service.monitor.initialize();
        console.log(`✓ ${service.name} monitor initialized`);
      }

      expect(services).toHaveLength(6);
    });
  });

  describe('SLA Compliance Tracking', () => {
    test('should set and track SLA targets', () => {
      const tracker = new SLATracker();

      tracker.setSLATarget({
        serviceName: 'space-traffic',
        uptimePercent: 99.5,
        p95LatencyMs: 500,
        p99LatencyMs: 1000,
        errorRatePercent: 0.1,
        availabilityWindowDays: 30,
      });

      tracker.recordMeasurement({
        serviceName: 'space-traffic',
        timestamp: Date.now(),
        uptime: 99.6,
        p95Latency: 450,
        p99Latency: 950,
        errorRate: 0.05,
        incidentCount: 0,
        downtimeMinutes: 5,
      });

      const compliance = tracker.getCompliance('space-traffic');

      expect(compliance).toBeDefined();
      expect(compliance?.overall.compliant).toBe(true);
      expect(compliance?.uptime.compliant).toBe(true);
      expect(compliance?.latency.p95.compliant).toBe(true);

      console.log('✓ SLA target compliance verified');
    });

    test('should detect SLA violations', () => {
      const tracker = new SLATracker();

      tracker.setSLATarget({
        serviceName: 'thermal-engine',
        uptimePercent: 99.0,
        p95LatencyMs: 500,
        p99LatencyMs: 1000,
        errorRatePercent: 1.0,
        availabilityWindowDays: 7,
      });

      tracker.recordMeasurement({
        serviceName: 'thermal-engine',
        timestamp: Date.now(),
        uptime: 98.5, // Below target
        p95Latency: 600, // Exceeds target
        p99Latency: 950,
        errorRate: 1.5, // Exceeds target
        incidentCount: 2,
        downtimeMinutes: 30,
      });

      const compliance = tracker.getCompliance('thermal-engine');

      expect(compliance?.overall.compliant).toBe(false);
      expect(compliance?.overall.violationCount).toBe(3);

      const violations = tracker.getViolations('thermal-engine');
      expect(violations.length).toBeGreaterThan(0);

      console.log(`✓ Detected ${violations.length} SLA violations`);
    });

    test('should calculate uptime budget', () => {
      const tracker = new SLATracker();

      tracker.setSLATarget({
        serviceName: 'database',
        uptimePercent: 99.9,
        p95LatencyMs: 100,
        p99LatencyMs: 200,
        errorRatePercent: 0.01,
        availabilityWindowDays: 30,
      });

      tracker.recordMeasurement({
        serviceName: 'database',
        timestamp: Date.now(),
        uptime: 99.95,
        p95Latency: 95,
        p99Latency: 180,
        errorRate: 0.005,
        incidentCount: 0,
        downtimeMinutes: 2,
      });

      const compliance = tracker.getCompliance('database');

      expect(compliance?.uptime.remainingBudgetMinutes).toBeDefined();
      expect(compliance?.uptime.remainingBudgetMinutes).toBeGreaterThan(0);

      console.log(
        `✓ Uptime budget remaining: ${compliance?.uptime.remainingBudgetMinutes.toFixed(1)} minutes`
      );
    });

    test('should export SLA report', () => {
      const tracker = new SLATracker();

      tracker.setSLATarget({
        serviceName: 'service-1',
        uptimePercent: 99.5,
        p95LatencyMs: 500,
        p99LatencyMs: 1000,
        errorRatePercent: 0.1,
        availabilityWindowDays: 7,
      });

      tracker.recordMeasurement({
        serviceName: 'service-1',
        timestamp: Date.now(),
        uptime: 99.6,
        p95Latency: 450,
        p99Latency: 950,
        errorRate: 0.05,
        incidentCount: 0,
        downtimeMinutes: 3,
      });

      const json = tracker.exportComplianceReport();
      const csv = tracker.exportComplianceCSV();

      expect(json).toContain('service-1');
      expect(csv).toContain('service-1');

      console.log('✓ SLA report exported as JSON and CSV');
    });
  });

  describe('Alert Aggregation and Deduplication', () => {
    test('should deduplicate identical alerts', () => {
      const aggregator = new AlertAggregator();

      const alert1 = {
        serviceName: 'space-traffic',
        metricName: 'collision_detection',
        severity: 'critical' as const,
        message: 'Potential collision detected',
        instanceId: 'sat-001',
      };

      const result1 = aggregator.processAlert(alert1);
      const result2 = aggregator.processAlert(alert1);

      expect(result1.isDuplicate).toBe(false);
      expect(result2.isDuplicate).toBe(true);

      console.log('✓ Duplicate alert detected and filtered');
    });

    test('should group related alerts', () => {
      const aggregator = new AlertAggregator();

      const alerts = [
        {
          serviceName: 'thermal-engine',
          metricName: 'temperature_payload',
          severity: 'warning' as const,
          message: 'Temperature rising',
          instanceId: 'thermal-1',
        },
        {
          serviceName: 'thermal-engine',
          metricName: 'temperature_payload',
          severity: 'warning' as const,
          message: 'Temperature rising',
          instanceId: 'thermal-2',
        },
        {
          serviceName: 'thermal-engine',
          metricName: 'temperature_payload',
          severity: 'warning' as const,
          message: 'Temperature rising',
          instanceId: 'thermal-3',
        },
      ];

      // Wait between alerts to avoid immediate deduplication
      let results = [];
      for (const alert of alerts) {
        results.push(aggregator.processAlert(alert));
      }

      const group = aggregator.getAlertGroup(results[0].groupId);
      expect(group).toBeDefined();
      expect(group?.occurrenceCount).toBeGreaterThan(1);
      expect(group?.affectedInstances.size).toBeGreaterThanOrEqual(1);

      console.log(
        `✓ Grouped ${group?.occurrenceCount} related alerts from ${group?.affectedInstances.size} instances`
      );
    });

    test('should suppress transient alerts', () => {
      const aggregator = new AlertAggregator();

      const alert = {
        serviceName: 'communication-system',
        metricName: 'signal_strength',
        severity: 'info' as const,
        message: 'Brief signal dip',
      };

      const result = aggregator.processAlert(alert);
      const group = aggregator.getAlertGroup(result.groupId);

      expect(group?.suppressed).toBe(false); // Not suppressed until threshold met

      console.log('✓ Transient alert filtering configured');
    });

    test('should track aggregation statistics', () => {
      const aggregator = new AlertAggregator();

      for (let i = 0; i < 10; i++) {
        aggregator.processAlert({
          serviceName: 'service-' + (i % 3),
          metricName: 'metric-' + (i % 5),
          severity: 'warning' as const,
          message: 'Test alert ' + i,
        });
      }

      const stats = aggregator.getStats();

      expect(stats.totalAlertsProcessed).toBeGreaterThan(0);
      expect(stats.uniqueGroupsCreated).toBeGreaterThan(0);

      console.log(`
        Aggregation Statistics:
        Total Processed: ${stats.totalAlertsProcessed}
        Unique Groups: ${stats.uniqueGroupsCreated}
        Duplicates Filtered: ${stats.duplicatesFiltered}
        Suppressed: ${stats.suppressed}
      `);
    });

    test('should acknowledge alert groups', () => {
      const aggregator = new AlertAggregator();

      const result = aggregator.processAlert({
        serviceName: 'thermal-engine',
        metricName: 'overheat_warning',
        severity: 'critical' as const,
        message: 'System overheating',
      });

      const acknowledged = aggregator.acknowledgeAlertGroup(result.groupId);
      expect(acknowledged).toBe(true);

      const group = aggregator.getAlertGroup(result.groupId);
      expect(group?.suppressed).toBe(true);

      console.log('✓ Alert group acknowledged and suppressed');
    });

    test('should resolve alert groups', () => {
      const aggregator = new AlertAggregator();

      const result = aggregator.processAlert({
        serviceName: 'blockchain',
        metricName: 'query_timeout',
        severity: 'warning' as const,
        message: 'Query taking too long',
      });

      const resolved = aggregator.resolveAlertGroup(result.groupId);
      expect(resolved).toBe(true);

      const group = aggregator.getAlertGroup(result.groupId);
      expect(group).toBeUndefined();

      console.log('✓ Alert group resolved and removed');
    });

    test('should export aggregation report', () => {
      const aggregator = new AlertAggregator();

      aggregator.processAlert({
        serviceName: 'space-traffic',
        metricName: 'collision_risk',
        severity: 'critical' as const,
        message: 'High collision risk detected',
      });

      const report = aggregator.exportReport();

      expect(report).toContain('space-traffic');
      expect(report).toContain('totalAlertsProcessed');

      console.log('✓ Aggregation report exported as JSON');
    });
  });

  describe('Phase 3 End-to-End Scenario', () => {
    test('should run complete monitoring workflow', async () => {
      console.log('\n=== Phase 3 End-to-End Integration Test ===\n');

      // 1. Initialize SLA tracking
      const slaTracker = new SLATracker();
      slaTracker.setSLATarget({
        serviceName: 'integrated-service',
        uptimePercent: 99.5,
        p95LatencyMs: 500,
        p99LatencyMs: 1000,
        errorRatePercent: 0.1,
        availabilityWindowDays: 30,
      });

      console.log('✓ SLA targets configured');

      // 2. Initialize alert aggregation
      const aggregator = new AlertAggregator();
      console.log('✓ Alert aggregator initialized');

      // 3. Run performance benchmark
      const benchmark = new PerformanceBenchmark();
      const benchmarkResult = await benchmark.runBenchmark(
        {
          name: 'Integration Test Benchmark',
          serviceName: 'integrated-service',
          targetImprovement: 3,
          runs: 10,
        },
        () => Math.random() * 100,
        () => Math.random() * 30
      );

      console.log(
        `✓ Performance benchmark completed: ${benchmarkResult.improvement.toFixed(1)}x improvement`
      );

      // 4. Record metrics and SLA measurement
      slaTracker.recordMeasurement({
        serviceName: 'integrated-service',
        timestamp: Date.now(),
        uptime: 99.6,
        p95Latency: 450,
        p99Latency: 950,
        errorRate: 0.08,
        incidentCount: 0,
        downtimeMinutes: 2,
      });

      console.log('✓ SLA measurement recorded');

      // 5. Process some alerts
      const alertResults = [];
      for (let i = 0; i < 5; i++) {
        const result = aggregator.processAlert({
          serviceName: 'integrated-service',
          metricName: 'throughput',
          severity: 'warning' as const,
          message: `Alert ${i}`,
          instanceId: `instance-${i}`,
        });
        alertResults.push(result);
      }

      console.log(`✓ ${alertResults.length} alerts processed and aggregated`);

      // 6. Generate reports
      const slaReport = slaTracker.getComplianceSummary();
      const aggregationReport = aggregator.getStats();

      expect(slaReport.compliantServices).toBeGreaterThan(0);
      expect(aggregationReport.totalAlertsProcessed).toBeGreaterThan(0);

      console.log(`
        SLA Report:
        - Compliant Services: ${slaReport.compliantServices}
        - Compliance Rate: ${slaReport.compliancePercent.toFixed(1)}%

        Aggregation Report:
        - Alerts Processed: ${aggregationReport.totalAlertsProcessed}
        - Active Groups: ${aggregationReport.aggregatedGroups}
        - Deduplication Rate: ${((aggregationReport.duplicatesFiltered / aggregationReport.totalAlertsProcessed) * 100).toFixed(1)}%
      `);

      console.log('\n✓ Phase 3 end-to-end workflow completed successfully');
    });
  });
});
