/**
 * Monitoring API Integration Test
 * Verify metrics collection and HTTP API functionality
 */

import MetricsCollector from '../../apps/monitoring/src/metrics-collector';
import MonitoringAPIServer from '../../apps/monitoring/src/monitoring-api';

describe('Metrics Collector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector('test-service');
  });

  describe('Metric Recording', () => {
    test('should record individual metric', () => {
      collector.recordMetric('responseTime', 45);

      const value = collector.getMetricValue('responseTime');
      expect(value).toBe(45);

      console.log('✓ Individual metric recorded');
    });

    test('should record multiple metrics', () => {
      collector.recordMetrics({
        responseTime: 50,
        errorCount: 2,
        throughput: 100,
      });

      expect(collector.getMetricValue('responseTime')).toBe(50);
      expect(collector.getMetricValue('errorCount')).toBe(2);
      expect(collector.getMetricValue('throughput')).toBe(100);

      console.log('✓ Multiple metrics recorded');
    });

    test('should record latency measurements', () => {
      collector.recordLatency('database_query', 123);
      collector.recordLatency('database_query', 156);

      const stats = collector.getMetricStats('latency_database_query');
      expect(stats.count).toBe(2);
      expect(stats.avg).toBeCloseTo(139.5, 1);

      console.log('✓ Latency measurements recorded');
    });

    test('should record throughput', () => {
      collector.recordThroughput('api_requests', 100);
      collector.recordThroughput('api_requests', 120);

      const value = collector.getMetricValue('throughput_api_requests');
      expect(value).toBe(120);

      console.log('✓ Throughput recorded');
    });

    test('should record errors', () => {
      collector.recordError('timeout');
      collector.recordError('timeout');
      collector.recordError('permission_denied');

      const timeoutStats = collector.getMetricStats('errors_timeout');
      expect(timeoutStats.count).toBe(2);

      console.log('✓ Errors recorded');
    });
  });

  describe('Metric Statistics', () => {
    test('should calculate metric average', () => {
      [10, 20, 30, 40, 50].forEach(value => {
        collector.recordMetric('values', value);
      });

      const avg = collector.getMetricAverage('values');
      expect(avg).toBe(30);

      console.log('✓ Average calculated correctly');
    });

    test('should calculate metric percentiles', () => {
      Array.from({ length: 100 }, (_, i) => i + 1).forEach(value => {
        collector.recordMetric('sequence', value);
      });

      const p50 = collector.getMetricPercentile('sequence', 50);
      const p95 = collector.getMetricPercentile('sequence', 95);
      const p99 = collector.getMetricPercentile('sequence', 99);

      expect(p50).toBeGreaterThan(40);
      expect(p50).toBeLessThan(60);
      expect(p95).toBeGreaterThan(p50);
      expect(p99).toBeGreaterThan(p95);

      console.log(`✓ Percentiles calculated: P50=${p50}, P95=${p95}, P99=${p99}`);
    });

    test('should get complete metric statistics', () => {
      [5, 15, 25, 35, 45].forEach(value => {
        collector.recordMetric('metric', value);
      });

      const stats = collector.getMetricStats('metric');

      expect(stats.count).toBe(5);
      expect(stats.min).toBe(5);
      expect(stats.max).toBe(45);
      expect(stats.avg).toBe(25);
      expect(stats.p50).toBeGreaterThanOrEqual(20);
      expect(stats.p95).toBeGreaterThanOrEqual(40);
      expect(stats.p99).toBeGreaterThanOrEqual(40);

      console.log(`
        Statistics:
        Count: ${stats.count}
        Min: ${stats.min}, Max: ${stats.max}, Avg: ${stats.avg}
        P50: ${stats.p50}, P95: ${stats.p95}, P99: ${stats.p99}
      `);
    });
  });

  describe('Window Management', () => {
    test('should maintain window size limit', () => {
      const windowCollector = new MetricsCollector('test', 50);

      // Record 100 metrics
      for (let i = 0; i < 100; i++) {
        windowCollector.recordMetric('metric', i);
      }

      const stats = windowCollector.getMetricStats('metric');

      // Should only keep last 50
      expect(stats.count).toBe(50);
      expect(stats.min).toBeGreaterThanOrEqual(50);

      console.log('✓ Window size limit enforced');
    });
  });

  describe('Metric Flushing', () => {
    test('should flush metrics to batch', () => {
      collector.recordMetrics({
        responseTime: 100,
        errorRate: 0.5,
        throughput: 1000,
      });

      const batch = collector.flush();

      expect(batch.serviceName).toBe('test-service');
      expect(batch.metrics.length).toBe(3);
      expect(batch.timestamp).toBeDefined();

      console.log(`✓ Flushed ${batch.metrics.length} metrics`);
    });

    test('should apply thresholds during flush', () => {
      collector.recordMetric('responseTime', 150);

      const batch = collector.flush({
        responseTime: 100,
      });

      const metric = batch.metrics.find(m => m.name === 'responseTime');
      expect(metric?.threshold).toBe(100);

      console.log('✓ Thresholds applied during flush');
    });

    test('should call flush callback', async () => {
      let callbackCalled = false;
      let receivedBatch: any = null;

      collector.setFlushCallback((batch) => {
        callbackCalled = true;
        receivedBatch = batch;
      });

      collector.recordMetric('test', 42);
      collector.flush();

      expect(callbackCalled).toBe(true);
      expect(receivedBatch).toBeDefined();
      expect(receivedBatch.metrics[0].value).toBe(42);

      console.log('✓ Flush callback executed');
    });
  });

  describe('Service Summary', () => {
    test('should generate service metrics summary', () => {
      collector.recordLatency('operation', 50);
      collector.recordLatency('operation', 60);
      collector.recordError('type1');

      const summary = collector.getSummary();

      expect(summary.serviceName).toBe('test-service');
      expect(summary.averageLatency).toBeGreaterThan(0);
      expect(summary.lastUpdate).toBeDefined();

      console.log(`
        Service Summary:
        Service: ${summary.serviceName}
        Avg Latency: ${summary.averageLatency.toFixed(2)}ms
        Throughput: ${summary.throughput}
      `);
    });
  });

  describe('Metric Utilities', () => {
    test('should get all metrics', () => {
      collector.recordMetrics({
        metric1: 10,
        metric2: 20,
        metric3: 30,
      });

      const all = collector.getAllMetrics();

      expect(Object.keys(all).length).toBeGreaterThan(0);
      expect(all.metric1).toBe(10);
      expect(all.metric2).toBe(20);

      console.log('✓ All metrics retrieved');
    });

    test('should clear all metrics', () => {
      collector.recordMetrics({
        metric1: 10,
        metric2: 20,
      });

      collector.clear();

      const value1 = collector.getMetricValue('metric1');
      const value2 = collector.getMetricValue('metric2');

      expect(value1).toBeUndefined();
      expect(value2).toBeUndefined();

      console.log('✓ All metrics cleared');
    });
  });
});

describe('Monitoring API Server', () => {
  let server: MonitoringAPIServer;

  beforeEach(() => {
    server = new MonitoringAPIServer(3001);
  });

  describe('API Server Initialization', () => {
    test('should create API server instance', () => {
      expect(server).toBeDefined();

      console.log('✓ API server created');
    });

    test('should get monitor instance', () => {
      const monitor = server.getMonitor();
      expect(monitor).toBeDefined();

      console.log('✓ Monitor instance retrieved');
    });

    test('should get or create collector', () => {
      const collector1 = server.getCollector('service-1');
      const collector2 = server.getCollector('service-1');

      expect(collector1).toBe(collector2);

      console.log('✓ Collector retrieved consistently');
    });
  });

  describe('Service Integration', () => {
    test('should integrate metrics collector with monitor', (done) => {
      const collector = server.getCollector('integration-service');

      collector.recordMetrics({
        responseTime: 100,
        errorRate: 0.5,
      });

      collector.flush();

      // Allow time for flush
      setTimeout(() => {
        const monitor = server.getMonitor();
        const metrics = monitor.getServiceMetrics('integration-service');

        expect(metrics.length).toBeGreaterThan(0);

        console.log(`✓ ${metrics.length} metrics integrated`);
        done();
      }, 100);
    });

    test('should handle multiple service collectors', () => {
      const collector1 = server.getCollector('service-1');
      const collector2 = server.getCollector('service-2');

      collector1.recordMetric('latency', 50);
      collector2.recordMetric('latency', 60);

      expect(collector1).not.toBe(collector2);

      console.log('✓ Multiple collectors created independently');
    });
  });

  describe('Periodic Flushing', () => {
    test('should start and stop periodic flushing', (done) => {
      const collector = server.getCollector('flush-service');

      collector.recordMetric('test', 123);
      collector.startPeriodicFlush(100);

      setTimeout(() => {
        collector.stopPeriodicFlush();

        const monitor = server.getMonitor();
        const metrics = monitor.getServiceMetrics('flush-service');

        expect(metrics.length).toBeGreaterThan(0);

        console.log('✓ Periodic flushing completed');
        done();
      }, 200);
    });
  });

  describe('High-Volume Metrics', () => {
    test('should handle high-volume metric collection', () => {
      const collector = server.getCollector('high-volume');

      // Record 1000 metrics
      for (let i = 0; i < 1000; i++) {
        collector.recordMetric('value', Math.random() * 100);
      }

      const stats = collector.getMetricStats('value');

      expect(stats.count).toBeGreaterThan(0);
      expect(stats.avg).toBeGreaterThan(0);

      console.log(`✓ 1000 metrics processed, avg: ${stats.avg.toFixed(2)}`);
    });

    test('should efficiently batch metrics', () => {
      const collector = server.getCollector('batch-service');

      // Record metrics in batches
      for (let batch = 0; batch < 10; batch++) {
        const metrics: Record<string, number> = {};
        for (let i = 0; i < 100; i++) {
          metrics[`metric_${i}`] = Math.random() * 100;
        }
        collector.recordMetrics(metrics);
      }

      const all = collector.getAllMetrics();

      expect(Object.keys(all).length).toBeGreaterThan(0);

      console.log(`✓ Batched 1000 metrics across 100 metric names`);
    });
  });

  describe('Real-World Scenarios', () => {
    test('should simulate microservice metrics collection', () => {
      const services = [
        'api-gateway',
        'database',
        'cache',
        'queue',
        'search-engine',
      ];

      services.forEach(serviceName => {
        const collector = server.getCollector(serviceName);

        // Record typical metrics
        for (let i = 0; i < 50; i++) {
          collector.recordLatency('operation', 20 + Math.random() * 80);
          collector.recordThroughput('requests', Math.floor(100 + Math.random() * 900));

          if (Math.random() > 0.95) {
            collector.recordError('timeout');
          }
        }

        const summary = collector.getSummary();
        expect(summary.averageLatency).toBeGreaterThan(0);
      });

      const monitor = server.getMonitor();
      const optimization = monitor.getOptimizationSummary();

      console.log(`✓ ${services.length} services monitored`);
    });

    test('should track performance improvements', () => {
      const collector = server.getCollector('optimized-service');

      // Simulate before optimization (slower)
      for (let i = 0; i < 50; i++) {
        collector.recordLatency('query', 500 + Math.random() * 200);
      }

      const beforeStats = collector.getMetricStats('latency_query');

      // Clear and simulate after optimization (faster)
      collector.clear();
      for (let i = 0; i < 50; i++) {
        collector.recordLatency('query', 50 + Math.random() * 50);
      }

      const afterStats = collector.getMetricStats('latency_query');

      const improvement = beforeStats.avg / afterStats.avg;

      expect(improvement).toBeGreaterThan(5); // 5x improvement

      console.log(
        `✓ Performance improved ${improvement.toFixed(1)}x: ${beforeStats.avg.toFixed(0)}ms → ${afterStats.avg.toFixed(0)}ms`
      );
    });
  });
});
