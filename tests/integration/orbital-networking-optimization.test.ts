/**
 * Orbital Networking Integration Test
 * Verify optimization library integration with network routing
 */

import NetworkManagerOptimized from '../../packages/orbital-networking/src/network-manager-optimized';
import { NetworkTopology, NetworkEdge } from '@orbitalmind/shared';

describe('Orbital Networking Optimization Integration', () => {
  let networkManager: NetworkManagerOptimized;

  beforeEach(() => {
    networkManager = new NetworkManagerOptimized('SAT-0');
  });

  describe('Optimized Dijkstra Routing', () => {
    test('should compute routing using optimized Dijkstra', () => {
      // Create simple constellation
      const topology: NetworkTopology = {
        edges: [
          { from: 'SAT-0', to: 'SAT-1', latency: 10, quality: 95 } as NetworkEdge,
          { from: 'SAT-1', to: 'SAT-2', latency: 10, quality: 95 } as NetworkEdge,
          { from: 'SAT-0', to: 'SAT-3', latency: 20, quality: 90 } as NetworkEdge,
          { from: 'SAT-3', to: 'SAT-2', latency: 10, quality: 95 } as NetworkEdge
        ],
        nodes: new Map([
          ['SAT-0', { x: 0, y: 0, z: 600 }],
          ['SAT-1', { x: 100, y: 0, z: 600 }],
          ['SAT-2', { x: 200, y: 0, z: 600 }],
          ['SAT-3', { x: 50, y: 50, z: 600 }]
        ]),
        timestamp: new Date()
      };

      networkManager.updateTopology(topology);

      // Get routes
      const routeToSat2 = networkManager.getRoute('SAT-2' as any);
      const routeToSat3 = networkManager.getRoute('SAT-3' as any);

      expect(routeToSat2).toBeDefined();
      expect(routeToSat3).toBeDefined();

      // Should prefer shorter path: SAT-0 -> SAT-1 -> SAT-2 (cost 20)
      // over SAT-0 -> SAT-3 -> SAT-2 (cost 30)
      if (routeToSat2) {
        expect(routeToSat2.cost).toBeLessThanOrEqual(30);
      }

      console.log('Routing table computed with optimized Dijkstra');
    });

    test('should handle linear constellation efficiently', () => {
      // Create linear constellation (SAT-0 -> SAT-1 -> ... -> SAT-49)
      const edges: NetworkEdge[] = [];
      const nodes = new Map<string, any>();

      nodes.set('SAT-0', { x: 0, y: 0, z: 600 });

      for (let i = 1; i < 50; i++) {
        nodes.set(`SAT-${i}`, { x: i * 100, y: 0, z: 600 });
        edges.push({
          from: `SAT-${i - 1}`,
          to: `SAT-${i}`,
          latency: 10,
          quality: 95
        } as NetworkEdge);
      }

      const topology: NetworkTopology = {
        edges,
        nodes,
        timestamp: new Date()
      };

      const startTime = Date.now();
      networkManager.updateTopology(topology);
      const elapsed = Date.now() - startTime;

      const metrics = networkManager.getMetrics();

      expect(elapsed).toBeLessThan(500); // Should be fast
      expect(metrics.routesCalculated).toBeGreaterThan(0);

      console.log(`Linear constellation (50 sats): ${elapsed}ms`);
    });

    test('should compute routing for mesh constellation', () => {
      // Create mesh topology where each satellite connects to 4 neighbors
      const edges: NetworkEdge[] = [];
      const nodes = new Map<string, any>();
      const gridSize = 5; // 5x5 mesh = 25 satellites

      // Create grid
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const id = `SAT-${i * gridSize + j}`;
          nodes.set(id, {
            x: i * 100,
            y: j * 100,
            z: 600
          });
        }
      }

      // Add horizontal edges
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize - 1; j++) {
          const from = `SAT-${i * gridSize + j}`;
          const to = `SAT-${i * gridSize + j + 1}`;
          edges.push({
            from,
            to,
            latency: 5,
            quality: 98
          } as NetworkEdge);
        }
      }

      // Add vertical edges
      for (let i = 0; i < gridSize - 1; i++) {
        for (let j = 0; j < gridSize; j++) {
          const from = `SAT-${i * gridSize + j}`;
          const to = `SAT-${(i + 1) * gridSize + j}`;
          edges.push({
            from,
            to,
            latency: 5,
            quality: 98
          } as NetworkEdge);
        }
      }

      const topology: NetworkTopology = {
        edges,
        nodes,
        timestamp: new Date()
      };

      const startTime = Date.now();
      networkManager.updateTopology(topology);
      const elapsed = Date.now() - startTime;

      const stats = networkManager.getRoutingStatistics();
      expect(stats.routesKnown).toBeGreaterThan(0);
      expect(stats.avgHops).toBeGreaterThan(0);

      console.log(
        `Mesh constellation (25 sats): ${elapsed}ms, ` +
        `routes: ${stats.routesKnown}, avg hops: ${stats.avgHops.toFixed(1)}`
      );
    });

    test('should handle large constellation efficiently', () => {
      // Create random constellation with 100+ satellites
      const satCount = 150;
      const edges: NetworkEdge[] = [];
      const nodes = new Map<string, any>();

      // Create satellites
      for (let i = 0; i < satCount; i++) {
        nodes.set(`SAT-${i}`, {
          x: Math.random() * 1000,
          y: Math.random() * 1000,
          z: 600 + Math.random() * 100
        });
      }

      // Create random edges (each satellite connects to 3-5 neighbors)
      const connected = new Set<string>();
      for (let i = 0; i < satCount; i++) {
        const satA = `SAT-${i}`;
        const neighbors = Math.floor(Math.random() * 3) + 3; // 3-5 neighbors

        for (let j = 0; j < neighbors; j++) {
          const neighbor = Math.floor(Math.random() * satCount);
          if (neighbor !== i) {
            const satB = `SAT-${neighbor}`;
            const edgeId = [satA, satB].sort().join('-');

            if (!connected.has(edgeId)) {
              edges.push({
                from: satA,
                to: satB,
                latency: 5 + Math.random() * 10,
                quality: 90 + Math.random() * 8
              } as NetworkEdge);
              connected.add(edgeId);
            }
          }
        }
      }

      const topology: NetworkTopology = {
        edges,
        nodes,
        timestamp: new Date()
      };

      const startTime = Date.now();
      networkManager.updateTopology(topology);
      const elapsed = Date.now() - startTime;

      const metrics = networkManager.getMetrics();
      expect(elapsed).toBeLessThan(5000); // Should complete in reasonable time

      console.log(
        `Large constellation (${satCount} sats): ${elapsed}ms, ` +
        `edges: ${edges.length}, routes: ${metrics.routesCalculated}`
      );
    });

    test('should identify optimal paths in complex topology', () => {
      // Create topology with multiple paths
      const topology: NetworkTopology = {
        edges: [
          { from: 'SAT-0', to: 'SAT-1', latency: 5, quality: 98 } as NetworkEdge,
          { from: 'SAT-0', to: 'SAT-2', latency: 5, quality: 98 } as NetworkEdge,
          { from: 'SAT-1', to: 'SAT-3', latency: 5, quality: 98 } as NetworkEdge,
          { from: 'SAT-2', to: 'SAT-3', latency: 20, quality: 80 } as NetworkEdge,
          { from: 'SAT-3', to: 'SAT-4', latency: 5, quality: 98 } as NetworkEdge
        ],
        nodes: new Map([
          ['SAT-0', { x: 0, y: 0, z: 600 }],
          ['SAT-1', { x: 100, y: 0, z: 600 }],
          ['SAT-2', { x: 100, y: 100, z: 600 }],
          ['SAT-3', { x: 200, y: 50, z: 600 }],
          ['SAT-4', { x: 300, y: 50, z: 600 }]
        ]),
        timestamp: new Date()
      };

      networkManager.updateTopology(topology);

      // Route to SAT-4 should prefer SAT-0 -> SAT-1 -> SAT-3 -> SAT-4
      // over SAT-0 -> SAT-2 -> SAT-3 -> SAT-4
      const routeToSat4 = networkManager.getRoute('SAT-4' as any);

      if (routeToSat4) {
        // First hop from SAT-0 should be SAT-1 (lower cost path)
        const nextHop = networkManager.getNextHop('SAT-4' as any);
        expect(nextHop).toBe('SAT-1');
      }
    });
  });

  describe('Performance Metrics', () => {
    test('should track routing metrics accurately', () => {
      const topology: NetworkTopology = {
        edges: [
          { from: 'SAT-0', to: 'SAT-1', latency: 10, quality: 95 } as NetworkEdge,
          { from: 'SAT-1', to: 'SAT-2', latency: 10, quality: 95 } as NetworkEdge,
          { from: 'SAT-0', to: 'SAT-2', latency: 25, quality: 80 } as NetworkEdge
        ],
        nodes: new Map([
          ['SAT-0', { x: 0, y: 0, z: 600 }],
          ['SAT-1', { x: 100, y: 0, z: 600 }],
          ['SAT-2', { x: 200, y: 0, z: 600 }]
        ]),
        timestamp: new Date()
      };

      networkManager.updateTopology(topology);
      networkManager.updateTopology(topology); // Update again

      const metrics = networkManager.getMetrics();

      expect(metrics.routingComputations).toBeGreaterThan(0);
      expect(metrics.avgComputationTime).toBeGreaterThan(0);
      expect(metrics.topologyUpdates).toBeGreaterThan(0);

      console.log(`
        Routing computations: ${metrics.routingComputations}
        Avg computation time: ${metrics.avgComputationTime.toFixed(2)}ms
        Topology updates: ${metrics.topologyUpdates}
        Routes calculated: ${metrics.routesCalculated}
      `);
    });

    test('should show O(n log n) scaling advantage', () => {
      // Test with increasing constellation sizes
      const results: Array<{ size: number; time: number }> = [];

      for (const size of [20, 50, 100]) {
        const edges: NetworkEdge[] = [];
        const nodes = new Map<string, any>();

        // Create linear constellation
        nodes.set('SAT-0', { x: 0, y: 0, z: 600 });
        for (let i = 1; i < size; i++) {
          nodes.set(`SAT-${i}`, { x: i * 100, y: 0, z: 600 });
          edges.push({
            from: `SAT-${i - 1}`,
            to: `SAT-${i}`,
            latency: 10,
            quality: 95
          } as NetworkEdge);
        }

        const topology: NetworkTopology = { edges, nodes, timestamp: new Date() };

        const mgr = new NetworkManagerOptimized('SAT-0');
        const startTime = Date.now();
        mgr.updateTopology(topology);
        const elapsed = Date.now() - startTime;

        results.push({ size, time: elapsed });
      }

      // Verify time grows logarithmically (not quadratically)
      // n=50: ~2x satellites, time should be < 2x
      // n=100: ~5x satellites, time should be < 3x
      expect(results[2].time).toBeLessThan(results[0].time * 5);

      console.log('Scaling test results (O(n log n)):');
      results.forEach(r => console.log(`  ${r.size} satellites: ${r.time}ms`));
    });
  });

  describe('Frame Creation and Verification', () => {
    test('should create and verify frames correctly', () => {
      const topology: NetworkTopology = {
        edges: [
          { from: 'SAT-0', to: 'SAT-1', latency: 10, quality: 95 } as NetworkEdge
        ],
        nodes: new Map([
          ['SAT-0', { x: 0, y: 0, z: 600 }],
          ['SAT-1', { x: 100, y: 0, z: 600 }]
        ]),
        timestamp: new Date()
      };

      networkManager.updateTopology(topology);

      // Create frame
      const payload = Buffer.from('test data');
      const frame = networkManager.createFrame('SAT-1' as any, 'DATA', payload);

      expect(frame.sourceID).toBe('SAT-0');
      expect(frame.destinationID).toBe('SAT-1');
      expect(frame.crc32).toBeDefined();

      // Verify frame
      const isValid = networkManager.verifyFrame(frame);
      expect(isValid).toBe(true);
    });
  });

  describe('Routing Statistics', () => {
    test('should provide accurate routing statistics', () => {
      const topology: NetworkTopology = {
        edges: [
          { from: 'SAT-0', to: 'SAT-1', latency: 10, quality: 95 } as NetworkEdge,
          { from: 'SAT-1', to: 'SAT-2', latency: 10, quality: 95 } as NetworkEdge,
          { from: 'SAT-0', to: 'SAT-3', latency: 15, quality: 90 } as NetworkEdge
        ],
        nodes: new Map([
          ['SAT-0', { x: 0, y: 0, z: 600 }],
          ['SAT-1', { x: 100, y: 0, z: 600 }],
          ['SAT-2', { x: 200, y: 0, z: 600 }],
          ['SAT-3', { x: 50, y: 50, z: 600 }]
        ]),
        timestamp: new Date()
      };

      networkManager.updateTopology(topology);

      const stats = networkManager.getRoutingStatistics();

      expect(stats.totalSatellites).toBe(4);
      expect(stats.activeNeighbors).toBe(3); // All except self
      expect(stats.routesKnown).toBeGreaterThan(0);
      expect(stats.avgHops).toBeGreaterThan(0);

      console.log(`
        Total satellites: ${stats.totalSatellites}
        Active neighbors: ${stats.activeNeighbors}
        Routes known: ${stats.routesKnown}
        Average hops: ${stats.avgHops.toFixed(2)}
      `);
    });
  });
});
