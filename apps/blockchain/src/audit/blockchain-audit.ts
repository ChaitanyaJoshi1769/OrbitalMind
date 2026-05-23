/**
 * Blockchain-based Audit Log System
 *
 * Immutable record of all constellation operations:
 * - Satellite state changes
 * - Resource allocation decisions
 * - Anomaly events
 * - Communication events
 * - Federated learning updates
 * - System emergencies
 *
 * Uses simplified blockchain concept:
 * - Chain of hashed blocks
 * - Merkle tree for transaction verification
 * - Timestamp ordering
 */

import pino from "pino";
import crypto from "crypto";

/**
 * Audit event types
 */
export enum AuditEventType {
  SATELLITE_STATE_CHANGE = "SATELLITE_STATE_CHANGE",
  RESOURCE_ALLOCATION = "RESOURCE_ALLOCATION",
  ANOMALY_DETECTED = "ANOMALY_DETECTED",
  ISL_ESTABLISHED = "ISL_ESTABLISHED",
  ISL_FAILED = "ISL_FAILED",
  COMMUNICATION_EVENT = "COMMUNICATION_EVENT",
  FEDERATED_LEARNING_UPDATE = "FEDERATED_LEARNING_UPDATE",
  SYSTEM_EMERGENCY = "SYSTEM_EMERGENCY",
  THERMAL_WARNING = "THERMAL_WARNING",
  POWER_CRITICAL = "POWER_CRITICAL",
  COLLISION_ALERT = "COLLISION_ALERT",
  GROUND_STATION_CONTACT = "GROUND_STATION_CONTACT",
  CONFIGURATION_CHANGE = "CONFIGURATION_CHANGE",
  SECURITY_EVENT = "SECURITY_EVENT",
}

/**
 * Audit event
 */
export interface AuditEvent {
  eventId: string;
  type: AuditEventType;
  timestamp: number;
  satelliteId?: string;
  details: Record<string, any>;
  severity: "low" | "medium" | "high" | "critical";
  source: string; // Service that generated this event
}

/**
 * Block in the audit chain
 */
export interface AuditBlock {
  blockId: string;
  blockNumber: number;
  previousHash: string;
  timestamp: number;
  events: AuditEvent[];
  eventCount: number;
  merkleRoot: string; // Root of merkle tree of events
  nonce: number; // For future proof-of-work
  blockHash: string; // SHA256 hash of block
}

/**
 * Merkle Tree for efficient verification
 */
class MerkleTree {
  private logger = pino();

  /**
   * Calculate merkle root from events
   */
  calculateRoot(events: AuditEvent[]): string {
    if (events.length === 0) {
      return crypto.createHash("sha256").digest("hex");
    }

    let hashes = events.map((event) => this.hashEvent(event));

    while (hashes.length > 1) {
      if (hashes.length % 2 !== 0) {
        hashes.push(hashes[hashes.length - 1]);
      }

      const newHashes: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const combined = hashes[i] + hashes[i + 1];
        newHashes.push(
          crypto.createHash("sha256").update(combined).digest("hex")
        );
      }

      hashes = newHashes;
    }

    return hashes[0];
  }

  /**
   * Hash single event
   */
  private hashEvent(event: AuditEvent): string {
    const eventString = JSON.stringify(event);
    return crypto.createHash("sha256").update(eventString).digest("hex");
  }

  /**
   * Verify event in tree
   */
  verifyEvent(event: AuditEvent, root: string, allEvents: AuditEvent[]): boolean {
    const calculatedRoot = this.calculateRoot(allEvents);
    return calculatedRoot === root;
  }
}

/**
 * Blockchain Audit System
 */
export class BlockchainAudit {
  private logger = pino();
  private chain: AuditBlock[] = [];
  private pendingEvents: AuditEvent[] = [];
  private merkleTree: MerkleTree = new MerkleTree();
  private blockSizeLimit: number = 1000; // Max events per block
  private blockCreationInterval: number = 60000; // Create block every 60 seconds
  private lastBlockTime: number = Date.now();

  constructor() {
    // Create genesis block
    this.createGenesisBlock();
    // Auto-create blocks periodically
    this.startBlockCreationTimer();
  }

  /**
   * Create genesis (first) block
   */
  private createGenesisBlock(): void {
    const genesisEvent: AuditEvent = {
      eventId: crypto.randomUUID(),
      type: AuditEventType.CONFIGURATION_CHANGE,
      timestamp: Date.now(),
      details: { message: "Blockchain audit system initialized" },
      severity: "low",
      source: "blockchain-audit",
    };

    const block = this.createBlock([genesisEvent], "0");
    this.chain.push(block);
    this.logger.info({ blockHash: block.blockHash }, "Genesis block created");
  }

  /**
   * Create a new block
   */
  private createBlock(
    events: AuditEvent[],
    previousHash: string
  ): AuditBlock {
    const blockNumber = this.chain.length;
    const blockId = crypto.randomUUID();
    const timestamp = Date.now();

    const merkleRoot = this.merkleTree.calculateRoot(events);

    const blockContent = {
      blockId,
      blockNumber,
      previousHash,
      timestamp,
      eventCount: events.length,
      merkleRoot,
    };

    const blockHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(blockContent))
      .digest("hex");

    return {
      blockId,
      blockNumber,
      previousHash,
      timestamp,
      events,
      eventCount: events.length,
      merkleRoot,
      nonce: 0,
      blockHash,
    };
  }

  /**
   * Add event to pending queue
   */
  addEvent(event: AuditEvent): void {
    // Generate event ID if not provided
    if (!event.eventId) {
      event.eventId = crypto.randomUUID();
    }

    // Ensure timestamp
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    this.pendingEvents.push(event);
    this.logger.info(
      {
        eventId: event.eventId,
        type: event.type,
        severity: event.severity,
      },
      "Event added to audit log"
    );

    // Create block if threshold reached
    if (this.pendingEvents.length >= this.blockSizeLimit) {
      this.forceBlockCreation();
    }
  }

  /**
   * Automatically create blocks on timer
   */
  private startBlockCreationTimer(): void {
    setInterval(() => {
      if (this.pendingEvents.length > 0) {
        this.forceBlockCreation();
      }
    }, this.blockCreationInterval);
  }

  /**
   * Force block creation from pending events
   */
  forceBlockCreation(): void {
    if (this.pendingEvents.length === 0) {
      return;
    }

    const previousBlock = this.chain[this.chain.length - 1];
    const block = this.createBlock(
      this.pendingEvents,
      previousBlock.blockHash
    );

    this.chain.push(block);
    this.lastBlockTime = Date.now();

    this.logger.info(
      {
        blockNumber: block.blockNumber,
        eventCount: block.eventCount,
        blockHash: block.blockHash,
      },
      "Block created and added to chain"
    );

    this.pendingEvents = [];
  }

  /**
   * Get all blocks
   */
  getChain(): AuditBlock[] {
    return this.chain;
  }

  /**
   * Get specific block
   */
  getBlock(blockNumber: number): AuditBlock | undefined {
    return this.chain[blockNumber];
  }

  /**
   * Get block by hash
   */
  getBlockByHash(hash: string): AuditBlock | undefined {
    return this.chain.find((block) => block.blockHash === hash);
  }

  /**
   * Get all events of specific type
   */
  getEventsByType(type: AuditEventType): AuditEvent[] {
    const events: AuditEvent[] = [];

    for (const block of this.chain) {
      events.push(...block.events.filter((e) => e.type === type));
    }

    return events;
  }

  /**
   * Get events for satellite
   */
  getSatelliteEvents(satelliteId: string): AuditEvent[] {
    const events: AuditEvent[] = [];

    for (const block of this.chain) {
      events.push(
        ...block.events.filter((e) => e.satelliteId === satelliteId)
      );
    }

    return events;
  }

  /**
   * Get events in time range
   */
  getEventsByTimeRange(startTime: number, endTime: number): AuditEvent[] {
    const events: AuditEvent[] = [];

    for (const block of this.chain) {
      events.push(
        ...block.events.filter(
          (e) => e.timestamp >= startTime && e.timestamp <= endTime
        )
      );
    }

    return events;
  }

  /**
   * Verify blockchain integrity
   */
  verifyChainIntegrity(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 1; i < this.chain.length; i++) {
      const block = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Check chain continuity
      if (block.previousHash !== previousBlock.blockHash) {
        errors.push(
          `Block ${i}: previousHash mismatch (broken link in chain)`
        );
      }

      // Check merkle root
      const calculatedMerkleRoot = this.merkleTree.calculateRoot(block.events);
      if (calculatedMerkleRoot !== block.merkleRoot) {
        errors.push(`Block ${i}: merkle root mismatch (tampered events)`);
      }

      // Verify block hash
      const blockContent = {
        blockId: block.blockId,
        blockNumber: block.blockNumber,
        previousHash: block.previousHash,
        timestamp: block.timestamp,
        eventCount: block.eventCount,
        merkleRoot: block.merkleRoot,
      };

      const calculatedHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(blockContent))
        .digest("hex");

      if (calculatedHash !== block.blockHash) {
        errors.push(`Block ${i}: block hash mismatch (block was modified)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalBlocks: number;
    totalEvents: number;
    pendingEvents: number;
    oldestEvent: number;
    newestEvent: number;
    eventsByType: Record<AuditEventType, number>;
    averageEventsSeverity: Record<string, number>;
  } {
    const eventsByType: Record<AuditEventType, number> = {} as Record<
      AuditEventType,
      number
    >;
    const severityCount = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const block of this.chain) {
      for (const event of block.events) {
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        severityCount[event.severity]++;
      }
    }

    let oldestEvent = Infinity;
    let newestEvent = 0;
    let totalEvents = 0;

    for (const block of this.chain) {
      totalEvents += block.events.length;
      for (const event of block.events) {
        oldestEvent = Math.min(oldestEvent, event.timestamp);
        newestEvent = Math.max(newestEvent, event.timestamp);
      }
    }

    return {
      totalBlocks: this.chain.length,
      totalEvents,
      pendingEvents: this.pendingEvents.length,
      oldestEvent: oldestEvent === Infinity ? 0 : oldestEvent,
      newestEvent,
      eventsByType,
      averageEventsSeverity: severityCount,
    };
  }

  /**
   * Export chain snapshot
   */
  exportSnapshot(): {
    chainLength: number;
    blocks: Array<{
      blockNumber: number;
      eventCount: number;
      blockHash: string;
      timestamp: number;
    }>;
    integrity: { isValid: boolean; errors: string[] };
  } {
    return {
      chainLength: this.chain.length,
      blocks: this.chain.map((b) => ({
        blockNumber: b.blockNumber,
        eventCount: b.eventCount,
        blockHash: b.blockHash,
        timestamp: b.timestamp,
      })),
      integrity: this.verifyChainIntegrity(),
    };
  }
}

export default BlockchainAudit;
