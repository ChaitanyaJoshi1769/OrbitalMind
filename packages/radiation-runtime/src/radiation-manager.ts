/**
 * OrbitalMind Radiation-Aware Execution Runtime
 * Provides fault-tolerant execution with ECC memory and checkpointing
 */

import {
  RadiationEvent,
  Checkpoint,
  InferenceTaskID,
  createInferenceTaskID
} from '@orbitalmind/shared';

export interface ECCMemoryBlock {
  address: number;
  size: number;
  data: Buffer;
  ecc: Buffer;
  lastVerified: Date;
  errorCount: number;
}

export interface CheckpointStorage {
  taskID: InferenceTaskID;
  checkpoint: Checkpoint;
  iterations: number;
  size: number;
  storedAt: Date;
}

/**
 * Radiation-aware memory manager with ECC protection
 */
export class RadiationManager {
  private memoryBlocks: Map<number, ECCMemoryBlock> = new Map();
  private radiationEvents: RadiationEvent[] = [];
  private checkpoints: Map<InferenceTaskID, CheckpointStorage[]> = new Map();
  private scrubInterval: number = 100;
  private isScrubbing: boolean = false;
  private seu24HourCount: number = 0;
  private lastScrubTime: Date = new Date();

  constructor() {
    this.startMemoryScrubbing();
  }

  /**
   * Register memory block for ECC protection
   */
  public registerMemoryBlock(address: number, size: number): void {
    const block: ECCMemoryBlock = {
      address,
      size,
      data: Buffer.alloc(size),
      ecc: Buffer.alloc(Math.ceil(size / 8)),
      lastVerified: new Date(),
      errorCount: 0
    };

    this.memoryBlocks.set(address, block);
  }

  /**
   * Write data to protected memory
   */
  public writeMemory(address: number, data: Buffer): void {
    const block = this.memoryBlocks.get(address);
    if (!block) {
      throw new Error(`Memory block not registered: 0x${address.toString(16)}`);
    }

    if (data.length > block.size) {
      throw new Error('Data exceeds block size');
    }

    block.data = Buffer.concat([
      data,
      Buffer.alloc(block.size - data.length, 0)
    ]);

    this.calculateECC(block);
  }

  /**
   * Read data from protected memory with error correction
   */
  public readMemory(address: number): Buffer {
    const block = this.memoryBlocks.get(address);
    if (!block) {
      throw new Error(`Memory block not registered: 0x${address.toString(16)}`);
    }

    const corrected = this.correctECC(block);

    if (corrected) {
      block.errorCount++;

      if (block.errorCount > 10) {
        console.error(`Memory block ${address} showing excessive errors`);
      }
    }

    return block.data;
  }

  /**
   * Calculate ECC for memory block
   */
  private calculateECC(block: ECCMemoryBlock): void {
    const ecc = Buffer.alloc(Math.ceil(block.size / 8));

    for (let i = 0; i < block.size; i++) {
      const byte = block.data[i];
      let parity = 0;

      for (let bit = 0; bit < 8; bit++) {
        parity ^= (byte >> bit) & 1;
      }

      const eccByte = Math.floor(i / 8);
      const eccBit = i % 8;
      if (parity) {
        ecc[eccByte] |= (1 << eccBit);
      }
    }

    block.ecc = ecc;
    block.lastVerified = new Date();
  }

  /**
   * Correct single-bit errors using ECC
   */
  private correctECC(block: ECCMemoryBlock): boolean {
    const currentECC = Buffer.alloc(block.ecc.length);

    for (let i = 0; i < block.size; i++) {
      const byte = block.data[i];
      let parity = 0;

      for (let bit = 0; bit < 8; bit++) {
        parity ^= (byte >> bit) & 1;
      }

      const eccByte = Math.floor(i / 8);
      const eccBit = i % 8;
      if (parity) {
        currentECC[eccByte] |= (1 << eccBit);
      }
    }

    let syndrome = 0;
    for (let i = 0; i < currentECC.length; i++) {
      syndrome |= (currentECC[i] ^ block.ecc[i]) << (i * 8);
    }

    if (syndrome === 0) {
      return false;
    }

    const errorByte = Math.floor(syndrome / 8);
    const errorBit = syndrome % 8;

    if (errorByte < block.data.length) {
      block.data[errorByte] ^= (1 << errorBit);
      this.calculateECC(block);
      return true;
    }

    console.error(`Uncorrectable memory error at syndrome: ${syndrome}`);
    return false;
  }

  /**
   * Start background memory scrubbing
   */
  private startMemoryScrubbing(): void {
    setInterval(() => {
      this.scrubMemory();
    }, this.scrubInterval);
  }

  /**
   * Scrub all memory blocks for errors
   */
  private async scrubMemory(): Promise<void> {
    if (this.isScrubbing) return;
    this.isScrubbing = true;

    try {
      let correctionsNeeded = 0;

      for (const [, block] of this.memoryBlocks) {
        const needsCorrection = this.correctECC(block);
        if (needsCorrection) {
          correctionsNeeded++;
        }
      }

      this.lastScrubTime = new Date();
    } finally {
      this.isScrubbing = false;
    }
  }

  /**
   * Record radiation event
   */
  public recordRadiationEvent(event: RadiationEvent): void {
    this.radiationEvents.push(event);

    if (this.radiationEvents.length > 10000) {
      this.radiationEvents.shift();
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.seu24HourCount = this.radiationEvents.filter(
      e => e.timestamp > oneDayAgo && e.eventType === 'SEU'
    ).length;
  }

  /**
   * Get radiation event statistics
   */
  public getRadiationStatistics() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = this.radiationEvents.filter(
      e => e.timestamp > oneDayAgo
    );

    const eventCounts = {
      seu: 0,
      set: 0,
      sel: 0,
      sefi: 0,
      tid: 0
    };

    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const event of recentEvents) {
      const typeKey = event.eventType.toLowerCase() as keyof typeof eventCounts;
      eventCounts[typeKey]++;
      severityCounts[event.severity as keyof typeof severityCounts]++;
    }

    return {
      total24h: recentEvents.length,
      eventTypes: eventCounts,
      bySeverity: severityCounts,
      corrected: recentEvents.filter(e => e.corrected).length,
      uncorrected: recentEvents.filter(e => !e.corrected).length
    };
  }

  /**
   * Create checkpoint for recovery
   */
  public createCheckpoint(
    taskID: InferenceTaskID,
    iteration: number,
    modelState: Buffer,
    inputBuffer: Buffer,
    computeState: Buffer
  ): Checkpoint {
    const checkpoint: Checkpoint = {
      taskID,
      iteration,
      timestamp: new Date(),
      modelState,
      inputBuffer,
      computeState,
      hash: this.calculateHash(Buffer.concat([modelState, inputBuffer, computeState]))
    };

    if (!this.checkpoints.has(taskID)) {
      this.checkpoints.set(taskID, []);
    }

    const storage: CheckpointStorage = {
      taskID,
      checkpoint,
      iterations: iteration,
      size: modelState.length + inputBuffer.length + computeState.length,
      storedAt: new Date()
    };

    const checkpoints = this.checkpoints.get(taskID)!;
    checkpoints.push(storage);

    if (checkpoints.length > 10) {
      checkpoints.shift();
    }

    return checkpoint;
  }

  /**
   * Restore from latest checkpoint
   */
  public restoreCheckpoint(taskID: InferenceTaskID): Checkpoint | null {
    const checkpoints = this.checkpoints.get(taskID);
    if (!checkpoints || checkpoints.length === 0) {
      return null;
    }

    const latest = checkpoints[checkpoints.length - 1];
    return latest.checkpoint;
  }

  /**
   * Verify checkpoint integrity
   */
  public verifyCheckpoint(checkpoint: Checkpoint): boolean {
    const data = Buffer.concat([
      checkpoint.modelState,
      checkpoint.inputBuffer,
      checkpoint.computeState
    ]);

    const hash = this.calculateHash(data);
    return hash === checkpoint.hash;
  }

  /**
   * Simple hash function for checkpoints
   */
  private calculateHash(data: Buffer): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Check if redundant execution is needed
   */
  public shouldUseRedundancy(): boolean {
    const stats = this.getRadiationStatistics();
    const threshold = 100;
    return stats.seu > threshold;
  }

  /**
   * Get memory health report
   */
  public getMemoryHealth() {
    let totalBlocks = 0;
    let errorFreeBlocks = 0;
    let degradedBlocks = 0;
    let totalErrors = 0;

    for (const block of this.memoryBlocks.values()) {
      totalBlocks++;
      if (block.errorCount === 0) {
        errorFreeBlocks++;
      } else if (block.errorCount > 10) {
        degradedBlocks++;
      }
      totalErrors += block.errorCount;
    }

    return {
      totalBlocks,
      errorFreeBlocks,
      degradedBlocks,
      totalErrors,
      avgErrorsPerBlock: totalBlocks > 0 ? totalErrors / totalBlocks : 0,
      lastScrubTime: this.lastScrubTime
    };
  }
}
