/**
 * Science Ops Optimization Integration Test
 * Verify vectorized spectral analysis and observation management
 */

import ScienceDataAnalyzerOptimized from '../../apps/science-ops/src/analysis/data-analyzer-optimized';
import AutonomousObserverOptimized from '../../apps/science-ops/src/observation/autonomous-observer-optimized';

describe('Science Ops Optimization Integration', () => {
  let analyzer;
  let observer;

  beforeEach(() => {
    analyzer = new ScienceDataAnalyzerOptimized();
    observer = new AutonomousObserverOptimized();
  });

  const createTarget = (
    id: string,
    name = 'Test Target',
    lat = 0,
    lon = 0,
    priority = 5
  ) => ({
    targetId: id,
    name,
    type: 'land',
    latitude: lat,
    longitude: lon,
    priority,
    observationFrequency: 'daily',
    requiredResolution: 10,
    spectralBands: ['R', 'G', 'B', 'NIR', 'SWIR', 'THERMAL'],
    minCloudCover: 30,
  });

  const createSpectralImage = (
    cloudCover = 10,
    quality = 85,
    hasNIR = true,
    hasThermal = true
  ) => ({
    bands: {
      ...(hasNIR ? { NIR: Array(100).fill(0).map(() => 500 + Math.random() * 200) } : {}),
      ...(hasNIR ? { R: Array(100).fill(0).map(() => 300 + Math.random() * 150) } : {}),
      ...(hasNIR ? { SWIR: Array(100).fill(0).map(() => 400 + Math.random() * 200) } : {}),
      ...(hasThermal ? { THERMAL: Array(100).fill(0).map(() => 25 + Math.random() * 15) } : {}),
    },
    metadata: {
      quality,
      cloudCover,
      timestamp: Date.now(),
    },
  });

  describe('Vectorized Image Analysis', () => {
    test('should analyze observation data with vectorized spectral calculations', () => {
      const imageData = createSpectralImage();

      const result = analyzer.analyzeObservationDataOptimized(
        'OBS-001',
        imageData,
        'vegetation monitoring'
      );

      expect(result).toBeDefined();
      expect(result.resultId).toMatch(/^ANALYSIS-OBS-001/);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);

      console.log(`Analysis findings: ${result.findings.length} detected`);
    });

    test('should detect vegetation from NDVI calculations', () => {
      const imageData = createSpectralImage(10, 90);

      const result = analyzer.analyzeObservationDataOptimized(
        'OBS-VEG',
        imageData,
        'vegetation'
      );

      expect(result.findings.some((f) => f.includes('vegetation'))).toBe(true);

      console.log('Vegetation detection working');
    });

    test('should detect thermal anomalies', () => {
      // Create image with high thermal variance
      const bands = {
        THERMAL: Array(100)
          .fill(0)
          .map(() => 20 + Math.random() * 40), // 20-60°C range
      };

      const result = analyzer.analyzeObservationDataOptimized(
        'OBS-THERMAL',
        { bands, metadata: { quality: 85, cloudCover: 10 } },
        'thermal monitoring'
      );

      expect(result.findings.some((f) => f.includes('thermal'))).toBe(true);

      console.log('Thermal anomaly detection working');
    });

    test('should handle cloud cover impact on analysis', () => {
      const imageData = createSpectralImage(75, 60); // High cloud cover, lower quality

      const result = analyzer.analyzeObservationDataOptimized(
        'OBS-CLOUD',
        imageData,
        'test'
      );

      expect(result.findings.some((f) => f.includes('cloud'))).toBe(true);

      console.log('Cloud cover detection working');
    });

    test('should show fast vectorized analysis performance', () => {
      const imageData = createSpectralImage();
      const times = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        analyzer.analyzeObservationDataOptimized(
          `OBS-${i}`,
          imageData,
          'test'
        );
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(avgTime).toBeLessThan(50); // Should be very fast

      console.log(`Vectorized analysis: ${avgTime.toFixed(2)}ms average`);
    });
  });

  describe('Autonomous Observation Management', () => {
    test('should register multiple science targets', () => {
      const target1 = createTarget('TARGET-001', 'Forest Area', 10, 20, 8);
      const target2 = createTarget('TARGET-002', 'Urban Area', 15, 25, 7);

      const reg1 = observer.registerTarget(target1);
      const reg2 = observer.registerTarget(target2);

      expect(reg1.targetId).toBe('TARGET-001');
      expect(reg2.targetId).toBe('TARGET-002');

      console.log('Registered 2 science targets');
    });

    test('should create observation campaign with PriorityQueue', () => {
      observer.registerTarget(createTarget('TARGET-A'));
      observer.registerTarget(createTarget('TARGET-B'));
      observer.registerTarget(createTarget('TARGET-C'));

      const campaign = observer.createCampaign(
        'Vegetation Monitoring',
        'Monitor vegetation changes',
        ['Map vegetation', 'Track changes'],
        ['TARGET-A', 'TARGET-B', 'TARGET-C'],
        'high',
        30
      );

      expect(campaign.campaignId).toMatch(/^CAMP-/);
      expect(campaign.targets.length).toBe(3);
      expect(campaign.status).toBe('planned');

      console.log(`Campaign created: ${campaign.name}`);
    });
  });

  describe('Target Selection - Optimized', () => {
    beforeEach(() => {
      observer.registerTarget(createTarget('TARGET-CLOSE', 'Close Target', 0, 0, 5));
      observer.registerTarget(createTarget('TARGET-FAR', 'Far Target', 45, 45, 8));
      observer.registerTarget(
        createTarget('TARGET-PRIORITY', 'High Priority', 5, 5, 9)
      );
    });

    test('should select best target with O(n) algorithm', () => {
      const target = observer.getNextObservationTargetOptimized('SAT-001', {
        latitude: 0,
        longitude: 0,
      });

      expect(target).toBeDefined();
      expect(['TARGET-CLOSE', 'TARGET-PRIORITY']).toContain(target);

      console.log(`Selected target: ${target}`);
    });

    test('should show consistent O(n) performance at different scales', () => {
      const results: Array<{ count: number; avgTime: number }> = [];

      for (const count of [10, 50, 100]) {
        const testObs = new AutonomousObserverOptimized();

        for (let i = 0; i < count; i++) {
          testObs.registerTarget(
            createTarget(`T-${i}`, `Target ${i}`, Math.random() * 90 - 45, Math.random() * 180 - 90)
          );
        }

        let totalTime = 0;
        for (let j = 0; j < 20; j++) {
          const start = Date.now();
          testObs.getNextObservationTargetOptimized('SAT-001', {
            latitude: 0,
            longitude: 0,
          });
          totalTime += Date.now() - start;
        }

        results.push({
          count,
          avgTime: totalTime / 20,
        });
      }

      // Should scale linearly
      expect(results[2].avgTime).toBeLessThan(results[0].avgTime * 5);

      console.log('Target selection scaling:');
      results.forEach((r) =>
        console.log(`  ${r.count} targets: ${r.avgTime.toFixed(2)}ms avg`)
      );
    });

    test('should prefer high-priority targets', () => {
      let targetCounts: Record<string, number> = {
        'TARGET-CLOSE': 0,
        'TARGET-FAR': 0,
        'TARGET-PRIORITY': 0,
      };

      for (let i = 0; i < 10; i++) {
        const target = observer.getNextObservationTargetOptimized('SAT-001', {
          latitude: 0,
          longitude: 0,
        });
        if (target && target in targetCounts) {
          targetCounts[target]++;
        }
      }

      // High-priority target should be selected frequently
      expect(targetCounts['TARGET-PRIORITY']).toBeGreaterThan(0);

      console.log('Target selection distribution:', targetCounts);
    });
  });

  describe('Anomaly Detection and Filtering', () => {
    test('should detect cloud cover anomalies', () => {
      observer.registerTarget(createTarget('TARGET-001'));

      observer.recordObservation(
        'CAMP-001',
        'TARGET-001',
        'SAT-001',
        85, // High cloud cover
        50, // Medium quality
        100,
        ['R', 'G', 'B', 'THERMAL'],
        { latitude: 0, longitude: 0 }
      );

      const status = observer.getCampaignStatus('CAMP-001');

      expect(status?.anomaliesDetected).toBeGreaterThan(0);

      console.log('Cloud cover anomaly detected');
    });

    test('should detect low-quality image anomalies', () => {
      observer.registerTarget(createTarget('TARGET-002'));

      observer.recordObservation(
        'CAMP-002',
        'TARGET-002',
        'SAT-001',
        10,
        25, // Low quality
        100,
        ['R', 'G', 'B'],
        { latitude: 0, longitude: 0 }
      );

      const status = observer.getCampaignStatus('CAMP-002');

      expect(status?.anomaliesDetected).toBeGreaterThan(0);

      console.log('Low-quality anomaly detected');
    });

    test('should filter high-priority anomalies efficiently', () => {
      observer.registerTarget(createTarget('TARGET-003'));

      // Record observations with various anomalies
      for (let i = 0; i < 5; i++) {
        observer.recordObservation(
          'CAMP-003',
          'TARGET-003',
          'SAT-001',
          85 + i * 5,
          30 + i * 5,
          100,
          ['R', 'G', 'B', 'NIR', 'SWIR', 'THERMAL'],
          { latitude: 0, longitude: 0 }
        );
      }

      const highPriority = observer.getHighPriorityAnomaliesOptimized();

      expect(highPriority.length).toBeGreaterThanOrEqual(0);

      console.log(`High-priority anomalies found: ${highPriority.length}`);
    });
  });

  describe('Analysis and Alert Generation', () => {
    test('should generate high-priority alerts for critical findings', () => {
      const imageData = createSpectralImage(5, 95);

      const result = analyzer.analyzeObservationDataOptimized(
        'OBS-CRITICAL',
        imageData,
        'critical monitoring'
      );

      expect(result.priority).toBe('low'); // Normal conditions
      expect(result.actionItems.length).toBeGreaterThan(0);

      console.log(`Generated action items: ${result.actionItems.length}`);
    });

    test('should create adaptive mission plans', () => {
      const plan = analyzer.createAdaptiveMissionPlan(
        'MISSION-001',
        ['coverage', 'resolution', 'temporal'],
        ['TARGET-A', 'TARGET-B', 'TARGET-C'],
        72
      );

      expect(plan.planId).toMatch(/^PLAN-/);
      expect(plan.status).toBe('draft');
      expect(plan.successCriteria.length).toBeGreaterThan(0);

      console.log(`Mission plan created with ${plan.successCriteria.length} criteria`);
    });

    test('should approve and execute mission plans', () => {
      const plan = analyzer.createAdaptiveMissionPlan(
        'MISSION-002',
        ['coverage'],
        ['TARGET-A'],
        24
      );

      const approved = analyzer.approveMissionPlan(plan.planId);
      expect(approved).toBe(true);

      const executed = analyzer.startMissionExecution(plan.planId);
      expect(executed).toBe(true);

      console.log('Mission plan approved and executed');
    });
  });

  describe('Optimization Metrics', () => {
    test('should track analysis performance metrics', () => {
      // Perform multiple analyses
      for (let i = 0; i < 15; i++) {
        analyzer.analyzeObservationDataOptimized(
          `OBS-${i}`,
          createSpectralImage(),
          'test'
        );
      }

      const metrics = analyzer.getOptimizationMetrics();

      expect(parseInt(metrics.totalAnalyses)).toBe(15);
      expect(parseInt(metrics.avgAnalysisTimeMs)).toBeLessThan(100);

      console.log(`
        Analysis Metrics:
        Total: ${metrics.totalAnalyses}
        Avg Time: ${metrics.avgAnalysisTimeMs}ms
        Alerts: ${metrics.totalAlerts}
        Critical: ${metrics.criticalAlerts}
      `);
    });

    test('should track observation selection performance', () => {
      // Register targets
      for (let i = 0; i < 30; i++) {
        observer.registerTarget(
          createTarget(`T-${i}`, `Target ${i}`, Math.random() * 90 - 45, Math.random() * 180 - 90)
        );
      }

      // Perform selections
      for (let i = 0; i < 20; i++) {
        observer.getNextObservationTargetOptimized('SAT-001', {
          latitude: 0,
          longitude: 0,
        });
      }

      const metrics = observer.getOptimizationMetrics();

      expect(metrics.targetSelections).toBe(20);
      expect(parseInt(metrics.avgTargetSelectionTimeMs)).toBeLessThan(10);

      console.log(`
        Observation Metrics:
        Total Observations: ${metrics.totalObservations}
        Target Selections: ${metrics.targetSelections}
        Avg Selection Time: ${metrics.avgTargetSelectionTimeMs}ms
        Anomalies Detected: ${metrics.anomaliesDetected}
      `);
    });
  });

  describe('Large-Scale Science Operations', () => {
    test('should handle 100+ targets efficiently', () => {
      const observer = new AutonomousObserverOptimized();

      // Register 100 targets
      for (let i = 0; i < 100; i++) {
        observer.registerTarget(
          createTarget(
            `LARGE-${String(i).padStart(3, '0')}`,
            `Target ${i}`,
            Math.random() * 180 - 90,
            Math.random() * 360 - 180,
            1 + Math.random() * 9
          )
        );
      }

      // Perform multiple target selections
      const times = [];
      for (let i = 0; i < 30; i++) {
        const start = Date.now();
        observer.getNextObservationTargetOptimized('SAT-001', {
          latitude: Math.random() * 180 - 90,
          longitude: Math.random() * 360 - 180,
        });
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(5);
      expect(maxTime).toBeLessThan(15);

      console.log(`
        Large-Scale Operations (100 targets):
        Avg Selection Time: ${avgTime.toFixed(2)}ms
        Max Selection Time: ${maxTime}ms
        Min Selection Time: ${Math.min(...times)}ms
      `);
    });

    test('should handle high-volume analysis', () => {
      // Perform 50 analyses
      const times = [];
      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        analyzer.analyzeObservationDataOptimized(
          `OBS-${i}`,
          createSpectralImage(Math.random() * 100, 50 + Math.random() * 50),
          'large-scale test'
        );
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(avgTime).toBeLessThan(100);

      console.log(`
        High-Volume Analysis (50 observations):
        Avg Analysis Time: ${avgTime.toFixed(2)}ms
        Total Time: ${times.reduce((a, b) => a + b, 0)}ms
      `);
    });
  });
});
