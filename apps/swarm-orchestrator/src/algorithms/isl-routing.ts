/**
 * ISL (Inter-Satellite Link) Routing Algorithms
 * 
 * Dynamic routing between satellites considering:
 * - Link quality and capacity
 * - Topology changes
 * - Latency constraints
 * - Power efficiency
 */

export interface ISLLink {
  sourceSatelliteId: string;
  destinationSatelliteId: string;
  quality: number; // 0-1
  latencyMs: number;
  bandwidthMbps: number;
  reliability: number; // 0-1
  lastUpdateTime: number;
}

export interface RoutingPath {
  source: string;
  destination: string;
  hops: string[];
  cost: number;
  latency: number;
  bandwidth: number;
  reliability: number;
  ttl: number;
}

export interface TopologySnapshot {
  timestamp: number;
  satelliteCount: number;
  links: ISLLink[];
  adjacencyMatrix: boolean[][];
}

/**
 * Dijkstra-based routing with multi-metric optimization
 */
export class DijkstraRouter {
  /**
   * Find shortest path between source and destination
   * Cost metric: latency (with quality weighting)
   */
  static findShortestPath(
    topology: TopologySnapshot,
    source: string,
    destination: string,
    satelliteIds: string[]
  ): RoutingPath | null {
    const nodeIndex: Record<string, number> = {};
    satelliteIds.forEach((id, idx) => {
      nodeIndex[id] = idx;
    });

    const n = satelliteIds.length;
    const dist = Array(n).fill(Number.POSITIVE_INFINITY);
    const parent = Array(n).fill(-1);
    const visited = Array(n).fill(false);

    const srcIdx = nodeIndex[source];
    const dstIdx = nodeIndex[destination];

    if (srcIdx === undefined || dstIdx === undefined) {
      return null;
    }

    dist[srcIdx] = 0;

    // Dijkstra algorithm
    for (let i = 0; i < n; i++) {
      let u = -1;
      let minDist = Number.POSITIVE_INFINITY;

      for (let j = 0; j < n; j++) {
        if (!visited[j] && dist[j] < minDist) {
          minDist = dist[j];
          u = j;
        }
      }

      if (u === -1 || u === dstIdx) break;
      visited[u] = true;

      const srcId = satelliteIds[u];

      for (const link of topology.links) {
        if (link.sourceSatelliteId !== srcId) continue;

        const v = nodeIndex[link.destinationSatelliteId];
        if (v === undefined) continue;

        if (visited[v]) continue;

        // Cost: inversely weighted by link quality (better quality = lower cost)
        const linkCost = link.latencyMs / (link.quality + 0.1);

        if (dist[u] + linkCost < dist[v]) {
          dist[v] = dist[u] + linkCost;
          parent[v] = u;
        }
      }
    }

    if (dist[dstIdx] === Number.POSITIVE_INFINITY) {
      return null; // No path found
    }

    // Reconstruct path
    const path: string[] = [];
    let curr = dstIdx;

    while (curr !== -1) {
      path.unshift(satelliteIds[curr]);
      curr = parent[curr];
    }

    // Calculate path metrics
    let totalLatency = 0;
    let minBandwidth = Number.POSITIVE_INFINITY;
    let reliabilityProduct = 1.0;

    for (let i = 0; i < path.length - 1; i++) {
      const link = topology.links.find(
        (l) => l.sourceSatelliteId === path[i] &&
               l.destinationSatelliteId === path[i + 1]
      );

      if (link) {
        totalLatency += link.latencyMs;
        minBandwidth = Math.min(minBandwidth, link.bandwidthMbps);
        reliabilityProduct *= link.reliability;
      }
    }

    return {
      source,
      destination,
      hops: path,
      cost: dist[dstIdx],
      latency: totalLatency,
      bandwidth: minBandwidth,
      reliability: reliabilityProduct,
      ttl: path.length,
    };
  }

  /**
   * Find multiple disjoint paths for load balancing
   */
  static findDisjointPaths(
    topology: TopologySnapshot,
    source: string,
    destination: string,
    satelliteIds: string[],
    maxPaths: number = 3
  ): RoutingPath[] {
    const paths: RoutingPath[] = [];
    const usedLinks = new Set<string>();

    for (let i = 0; i < maxPaths; i++) {
      // Find path avoiding previously used links
      const availableLinks = topology.links.filter((link) => {
        const linkKey = `${link.sourceSatelliteId}-${link.destinationSatelliteId}`;
        return !usedLinks.has(linkKey);
      });

      const tempTopology: TopologySnapshot = {
        ...topology,
        links: availableLinks,
      };

      const path = this.findShortestPath(
        tempTopology,
        source,
        destination,
        satelliteIds
      );

      if (!path) break;

      paths.push(path);

      // Mark used links
      for (let j = 0; j < path.hops.length - 1; j++) {
        const linkKey = `${path.hops[j]}-${path.hops[j + 1]}`;
        usedLinks.add(linkKey);
      }
    }

    return paths;
  }
}

/**
 * Greedy routing based on link quality
 * Fast, minimal computation for real-time decisions
 */
export class GreedyRouter {
  /**
   * Forward packet to best available neighbor
   * Best = highest quality, lowest latency
   */
  static findBestNextHop(
    currentNode: string,
    destination: string,
    availableNeighbors: ISLLink[]
  ): string | null {
    // Filter neighbors we're connected to
    const outgoingLinks = availableNeighbors.filter(
      (link) => link.sourceSatelliteId === currentNode
    );

    if (outgoingLinks.length === 0) {
      return null;
    }

    // Sort by composite score: quality * (1 - normalized_latency)
    const scored = outgoingLinks.map((link) => ({
      next: link.destinationSatelliteId,
      score: link.quality * (1 - Math.min(link.latencyMs / 100, 1)),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].next;
  }

  /**
   * Find next hops considering destination proximity
   * Uses geographic distance estimate (based on orbital position)
   */
  static findNextHopsWithProximity(
    currentNode: string,
    destination: string,
    availableNeighbors: ISLLink[],
    satellitePositions: Record<string, { lat: number; lon: number }>
  ): string[] {
    const outgoingLinks = availableNeighbors.filter(
      (link) => link.sourceSatelliteId === currentNode
    );

    const destPos = satellitePositions[destination];
    if (!destPos) {
      // Fallback to quality-based sorting
      return outgoingLinks
        .sort((a, b) => b.quality - a.quality)
        .map((l) => l.destinationSatelliteId);
    }

    // Score based on quality and proximity to destination
    const scored = outgoingLinks.map((link) => {
      const nextPos = satellitePositions[link.destinationSatelliteId];
      const distance = nextPos
        ? Math.hypot(
            nextPos.lat - destPos.lat,
            nextPos.lon - destPos.lon
          )
        : 1000;

      const proximityScore = 1 / (1 + distance / 50); // Normalize by constellation size
      const score = 0.7 * link.quality + 0.3 * proximityScore;

      return { next: link.destinationSatelliteId, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.next);
  }
}

/**
 * Link Quality Monitor
 * Tracks ISL link health and predicts failures
 */
export class LinkQualityMonitor {
  private linkHistory: Map<string, number[]>;
  private degradationThreshold: number = 0.5; // Quality below 0.5 = degraded

  constructor(private historySize: number = 100) {
    this.linkHistory = new Map();
  }

  /**
   * Update link quality measurement
   */
  recordMeasurement(
    sourceId: string,
    destId: string,
    quality: number
  ): void {
    const linkKey = `${sourceId}-${destId}`;
    if (!this.linkHistory.has(linkKey)) {
      this.linkHistory.set(linkKey, []);
    }

    const history = this.linkHistory.get(linkKey)!;
    history.push(quality);

    if (history.length > this.historySize) {
      history.shift();
    }
  }

  /**
   * Get link quality statistics
   */
  getLinkStats(sourceId: string, destId: string): {
    current: number;
    average: number;
    trend: number;
    isDegraded: boolean;
  } | null {
    const linkKey = `${sourceId}-${destId}`;
    const history = this.linkHistory.get(linkKey);

    if (!history || history.length === 0) {
      return null;
    }

    const current = history[history.length - 1];
    const average = history.reduce((a, b) => a + b, 0) / history.length;

    // Calculate trend (linear regression)
    let trend = 0;
    if (history.length > 1) {
      const n = history.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = history.reduce((a, b) => a + b, 0);
      const sumXY = history.reduce((sum, val, idx) => sum + idx * val, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      trend = slope;
    }

    return {
      current,
      average,
      trend,
      isDegraded: average < this.degradationThreshold,
    };
  }

  /**
   * Predict link failure probability
   * Based on trend analysis
   */
  predictFailureProbability(sourceId: string, destId: string): number {
    const stats = this.getLinkStats(sourceId, destId);
    if (!stats) return 0;

    // If quality is already below threshold and trending down, high failure risk
    if (stats.isDegraded && stats.trend < 0) {
      return Math.min(0.9, Math.abs(stats.trend) * 10);
    }

    // If quality is good but trending down rapidly, medium risk
    if (stats.trend < -0.1) {
      return Math.min(0.5, Math.abs(stats.trend) * 5);
    }

    return 0;
  }

  /**
   * Get degraded links
   */
  getDegradedLinks(): Array<{
    link: string;
    quality: number;
    trend: number;
  }> {
    const degraded = [];

    for (const [linkKey, history] of this.linkHistory) {
      if (history.length === 0) continue;

      const stats = this.getLinkStats(
        linkKey.split("-")[0],
        linkKey.split("-")[1]
      );
      if (stats?.isDegraded) {
        degraded.push({
          link: linkKey,
          quality: stats.current,
          trend: stats.trend,
        });
      }
    }

    return degraded;
  }
}

/**
 * Topology Change Detector
 * Identifies when ISL topology changes significantly
 */
export class TopologyChangeDetector {
  private previousTopology?: TopologySnapshot;
  private changeThreshold: number = 0.2; // 20% link change = significant

  /**
   * Detect topology changes between consecutive snapshots
   */
  detectChanges(
    currentTopology: TopologySnapshot
  ): {
    added: ISLLink[];
    removed: ISLLink[];
    modified: Array<{ old: ISLLink; new: ISLLink }>;
    changePercentage: number;
    isSignificant: boolean;
  } {
    const added: ISLLink[] = [];
    const removed: ISLLink[] = [];
    const modified: Array<{ old: ISLLink; new: ISLLink }> = [];

    if (!this.previousTopology) {
      this.previousTopology = currentTopology;
      return { added: [], removed: [], modified: [], changePercentage: 0, isSignificant: false };
    }

    const prevLinkMap = new Map(
      this.previousTopology.links.map((l) => [
        `${l.sourceSatelliteId}-${l.destinationSatelliteId}`,
        l,
      ])
    );

    const currLinkMap = new Map(
      currentTopology.links.map((l) => [
        `${l.sourceSatelliteId}-${l.destinationSatelliteId}`,
        l,
      ])
    );

    // Find added and modified links
    for (const [key, currLink] of currLinkMap) {
      const prevLink = prevLinkMap.get(key);
      if (!prevLink) {
        added.push(currLink);
      } else if (prevLink.quality !== currLink.quality) {
        modified.push({ old: prevLink, new: currLink });
      }
    }

    // Find removed links
    for (const [key, prevLink] of prevLinkMap) {
      if (!currLinkMap.has(key)) {
        removed.push(prevLink);
      }
    }

    const totalLinks = Math.max(prevLinkMap.size, currLinkMap.size);
    const changeCount = added.length + removed.length + modified.length;
    const changePercentage = totalLinks > 0 ? changeCount / totalLinks : 0;

    this.previousTopology = currentTopology;

    return {
      added,
      removed,
      modified,
      changePercentage,
      isSignificant: changePercentage >= this.changeThreshold,
    };
  }
}
