/**
 * OrbitalMind Orbital Networking System
 * Inter-satellite mesh networking with dynamic routing
 */

import {
  SatelliteID,
  NetworkFrame,
  NetworkTopology,
  RoutingEntry,
  OrbitalPosition,
  NetworkEdge,
  createSatelliteID,
  calculateDistance,
  generateID,
  calculateCRC32
} from '@orbitalmind/shared';

export interface LinkQuality {
  bandwidth: number;    // Gbps
  latency: number;      // ms
  reliability: number;  // 0-100%
  signalStrength: number; // dBm
}

/**
 * Network Manager handles inter-satellite communications
 */
export class NetworkManager {
  private topology: NetworkTopology;
  private routingTable: Map<SatelliteID, RoutingEntry> = new Map();
  private linkQualities: Map<string, LinkQuality> = new Map();
  private satelliteID: SatelliteID;
  private neighbors: Map<SatelliteID, OrbitalPosition> = new Map();

  constructor(satelliteID: SatelliteID) {
    this.satelliteID = satelliteID;
    this.topology = {
      edges: [],
      nodes: new Map(),
      timestamp: new Date()
    };
  }

  /**
   * Update network topology
   */
  public updateTopology(topology: NetworkTopology): void {
    this.topology = topology;

    // Update neighbors (satellites within communication range)
    this.neighbors.clear();

    for (const [satID, position] of topology.nodes) {
      if (satID !== this.satelliteID) {
        this.neighbors.set(satID, position);
      }
    }

    // Recompute routing table
    this.computeRoutingTable();
  }

  /**
   * Compute optimal routing using Dijkstra's algorithm
   */
  private computeRoutingTable(): void {
    const distances: Map<SatelliteID, number> = new Map();
    const previous: Map<SatelliteID, SatelliteID> = new Map();
    const unvisited = new Set<SatelliteID>();

    // Initialize distances
    for (const [satID] of this.topology.nodes) {
      distances.set(satID, satID === this.satelliteID ? 0 : Infinity);
      unvisited.add(satID);
    }

    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let minSat: SatelliteID | undefined;
      let minDist = Infinity;

      for (const sat of unvisited) {
        const dist = distances.get(sat) ?? Infinity;
        if (dist < minDist) {
          minDist = dist;
          minSat = sat;
        }
      }

      if (!minSat || minDist === Infinity) break;

      unvisited.delete(minSat);

      // Check neighbors
      for (const edge of this.topology.edges) {
        const neighbor = edge.from === minSat ? edge.to :
                        edge.to === minSat ? edge.from : null;

        if (!neighbor || !unvisited.has(neighbor)) continue;

        const edgeCost = this.calculateEdgeCost(edge);
        const newDist = minDist + edgeCost;
        const neighborDist = distances.get(neighbor) ?? Infinity;

        if (newDist < neighborDist) {
          distances.set(neighbor, newDist);
          previous.set(neighbor, minSat);
        }
      }
    }

    // Build routing table
    this.routingTable.clear();

    for (const [dest] of this.topology.nodes) {
      if (dest === this.satelliteID) continue;

      let nextHop = dest;
      let hopCount = 0;

      // Trace back path
      let current = dest;
      while (current !== this.satelliteID && previous.has(current)) {
        const prev = previous.get(current)!;
        if (prev === this.satelliteID) {
          nextHop = current;
          break;
        }
        current = prev;
        hopCount++;
      }

      hopCount++;

      const entry: RoutingEntry = {
        destination: dest,
        nextHop: nextHop as SatelliteID,
        hopCount,
        linkStability: this.calculateLinkStability(nextHop as SatelliteID),
        predictedDuration: this.predictLinkDuration(nextHop as SatelliteID),
        estimatedLatency: this.estimateLatency(nextHop as SatelliteID, hopCount),
        cost: distances.get(dest) ?? Infinity,
        lastUpdated: new Date()
      };

      this.routingTable.set(dest, entry);
    }
  }

  /**
   * Calculate cost for an edge
   */
  private calculateEdgeCost(edge: NetworkEdge): number {
    // Cost = latency + (1 - reliability) * 100
    const reliabilityCost = (1 - edge.quality / 100) * 100;
    return edge.latency + reliabilityCost;
  }

  /**
   * Calculate link stability (0-100%)
   */
  private calculateLinkStability(neighborID: SatelliteID): number {
    // Based on orbital mechanics: satellites in same orbital plane are more stable
    return 85; // Placeholder
  }

  /**
   * Predict link duration (seconds)
   */
  private predictLinkDuration(neighborID: SatelliteID): number {
    // LEO satellites pass every 10-15 minutes typically
    return 900; // 15 minutes in seconds
  }

  /**
   * Estimate latency with hop count
   */
  private estimateLatency(neighborID: SatelliteID, hopCount: number): number {
    // ~1ms per hop + 3ms link propagation delay
    return 3 + hopCount;
  }

  /**
   * Get next hop for destination
   */
  public getNextHop(destination: SatelliteID): SatelliteID | null {
    const route = this.routingTable.get(destination);
    return route ? route.nextHop : null;
  }

  /**
   * Create network frame
   */
  public createFrame(
    destination: SatelliteID,
    frameType: string,
    payload: Buffer
  ): NetworkFrame {
    const frame: NetworkFrame = {
      sourceID: this.satelliteID,
      destinationID: destination,
      sequenceNumber: Math.floor(Math.random() * 0xFFFFFFFF),
      frameType: frameType as any,
      payload,
      timestamp: new Date()
    };

    // Calculate CRC32
    const frameData = Buffer.concat([
      Buffer.from(this.satelliteID),
      Buffer.from(destination),
      Buffer.alloc(4),  // Sequence number placeholder
      Buffer.from(frameType),
      payload
    ]);

    frame.crc32 = calculateCRC32(frameData);

    return frame;
  }

  /**
   * Verify frame integrity
   */
  public verifyFrame(frame: NetworkFrame): boolean {
    if (!frame.crc32) return true; // No CRC check if not set

    const frameData = Buffer.concat([
      Buffer.from(frame.sourceID),
      Buffer.from(frame.destinationID),
      Buffer.alloc(4),
      Buffer.from(frame.frameType),
      frame.payload
    ]);

    const calculatedCRC = calculateCRC32(frameData);
    return calculatedCRC === frame.crc32;
  }

  /**
   * Get routing statistics
   */
  public getRoutingStatistics() {
    return {
      totalSatellites: this.topology.nodes.size,
      activeNeighbors: this.neighbors.size,
      routesKnown: this.routingTable.size,
      avgHops: Array.from(this.routingTable.values()).reduce((sum, r) => sum + r.hopCount, 0) /
               Math.max(1, this.routingTable.size)
    };
  }

  /**
   * Get topology snapshot
   */
  public getTopology(): NetworkTopology {
    return {
      edges: [...this.topology.edges],
      nodes: new Map(this.topology.nodes),
      timestamp: this.topology.timestamp
    };
  }
}

/**
 * Gossip Protocol for distributed state synchronization
 */
export class GossipProtocol {
  private localState: Map<string, any> = new Map();
  private seenMessages: Set<string> = new Set();

  /**
   * Get local state snapshot
   */
  public getState(): Map<string, any> {
    return new Map(this.localState);
  }

  /**
   * Merge remote state with local
   */
  public mergeState(remoteState: Map<string, any>, timestamp: Date): void {
    for (const [key, remoteValue] of remoteState) {
      const localValue = this.localState.get(key);

      if (!localValue || remoteValue.timestamp > localValue.timestamp) {
        this.localState.set(key, remoteValue);
      }
    }
  }

  /**
   * Gossip about a value
   */
  public gossipValue(key: string, value: any, timestamp: Date): void {
    this.localState.set(key, { value, timestamp });
  }

  /**
   * Track seen messages to prevent loops
   */
  public trackMessage(messageID: string): boolean {
    if (this.seenMessages.has(messageID)) {
      return false;
    }

    this.seenMessages.add(messageID);

    // Keep last 10000 messages
    if (this.seenMessages.size > 10000) {
      const arr = Array.from(this.seenMessages);
      this.seenMessages = new Set(arr.slice(-10000));
    }

    return true;
  }
}
