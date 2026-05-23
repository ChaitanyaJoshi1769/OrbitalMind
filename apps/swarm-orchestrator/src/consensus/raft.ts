/**
 * RAFT Consensus Algorithm Implementation
 * 
 * Enables distributed consensus among satellites for:
 * - Formation flying decisions
 * - ISL topology changes
 * - Resource allocation
 * - Failure recovery
 */

import { v4 as uuidv4 } from "uuid";
import pino from "pino";

export enum NodeState {
  FOLLOWER = "follower",
  CANDIDATE = "candidate",
  LEADER = "leader",
}

export enum LogEntryType {
  STATE_CHANGE = "state_change",
  TOPOLOGY_UPDATE = "topology_update",
  ALLOCATION_CHANGE = "allocation_change",
  FORMATION_COMMAND = "formation_command",
}

export interface LogEntry {
  term: number;
  index: number;
  type: LogEntryType;
  data: Record<string, any>;
  timestamp: number;
}

export interface RaftConfig {
  electionTimeoutMin: number; // ms
  electionTimeoutMax: number; // ms
  heartbeatInterval: number; // ms
  commitTimeout: number; // ms
}

export interface RaftState {
  currentTerm: number;
  votedFor?: string;
  log: LogEntry[];
  commitIndex: number;
  lastApplied: number;
}

export interface RaftPeerState {
  nextIndex: number;
  matchIndex: number;
}

/**
 * RAFT Consensus Node
 * Each satellite runs a RAFT instance for distributed decision-making
 */
export class RaftNode {
  private nodeId: string;
  private state: NodeState = NodeState.FOLLOWER;
  private raftState: RaftState;
  private peerStates: Map<string, RaftPeerState>;
  private config: RaftConfig;
  private logger = pino();
  
  private currentLeader?: string;
  private electionTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  
  // Callbacks for state machine
  private onLeaderElected?: (leaderId: string) => Promise<void>;
  private onEntryCommitted?: (entry: LogEntry) => Promise<void>;
  private onStateChanged?: (newState: NodeState) => Promise<void>;
  
  constructor(
    nodeId: string,
    peerIds: string[],
    config: Partial<RaftConfig> = {}
  ) {
    this.nodeId = nodeId;
    this.config = {
      electionTimeoutMin: 150,
      electionTimeoutMax: 300,
      heartbeatInterval: 50,
      commitTimeout: 100,
      ...config,
    };
    
    this.raftState = {
      currentTerm: 0,
      log: [],
      commitIndex: 0,
      lastApplied: 0,
    };
    
    this.peerStates = new Map(
      peerIds.map((peerId) => [
        peerId,
        {
          nextIndex: 1,
          matchIndex: 0,
        },
      ])
    );
  }

  /**
   * Start the RAFT node
   */
  async start(): Promise<void> {
    this.logger.info({ nodeId: this.nodeId }, "Starting RAFT node");
    this.resetElectionTimer();
  }

  /**
   * Stop the RAFT node
   */
  async shutdown(): Promise<void> {
    this.clearTimers();
    this.logger.info({ nodeId: this.nodeId }, "RAFT node shut down");
  }

  /**
   * Request vote from peer (called during election)
   */
  async requestVote(
    candidateId: string,
    term: number,
    lastLogIndex: number,
    lastLogTerm: number
  ): Promise<{ term: number; voteGranted: boolean }> {
    // If request term is older than current, reject
    if (term < this.raftState.currentTerm) {
      return { term: this.raftState.currentTerm, voteGranted: false };
    }

    // If request term is newer, step down
    if (term > this.raftState.currentTerm) {
      this.raftState.currentTerm = term;
      this.raftState.votedFor = undefined;
      await this.becomeFollower();
    }

    // Check if we can vote for this candidate
    const lastLogTerm_ = this.getLastLogTerm();
    const lastLogIndex_ = this.getLastLogIndex();

    const canVote =
      (this.raftState.votedFor === undefined ||
        this.raftState.votedFor === candidateId) &&
      lastLogTerm <= lastLogTerm_ &&
      (lastLogTerm < lastLogTerm_ || lastLogIndex <= lastLogIndex_);

    if (canVote) {
      this.raftState.votedFor = candidateId;
      return { term: this.raftState.currentTerm, voteGranted: true };
    }

    return { term: this.raftState.currentTerm, voteGranted: false };
  }

  /**
   * Append entries RPC (leader sends to followers)
   */
  async appendEntries(
    leaderId: string,
    term: number,
    prevLogIndex: number,
    prevLogTerm: number,
    entries: LogEntry[],
    leaderCommit: number
  ): Promise<{
    term: number;
    success: boolean;
    matchIndex?: number;
  }> {
    // If term is old, reject
    if (term < this.raftState.currentTerm) {
      return { term: this.raftState.currentTerm, success: false };
    }

    // Update current term if newer
    if (term > this.raftState.currentTerm) {
      this.raftState.currentTerm = term;
      this.raftState.votedFor = undefined;
    }

    // Step down if we're a leader
    if (this.state === NodeState.LEADER && term > this.raftState.currentTerm) {
      await this.becomeFollower();
    }

    // Acknowledge leader heartbeat
    this.currentLeader = leaderId;
    this.resetElectionTimer();

    // Check log matching
    const lastLogIndex = this.getLastLogIndex();
    if (prevLogIndex > lastLogIndex) {
      return { term: this.raftState.currentTerm, success: false };
    }

    if (prevLogIndex > 0) {
      const prevEntry = this.raftState.log[prevLogIndex - 1];
      if (!prevEntry || prevEntry.term !== prevLogTerm) {
        return { term: this.raftState.currentTerm, success: false };
      }
    }

    // Append new entries
    let matchIndex = prevLogIndex;
    for (const entry of entries) {
      matchIndex = Math.max(matchIndex, entry.index);
      if (entry.index > this.raftState.log.length) {
        this.raftState.log.push(entry);
      } else if (this.raftState.log[entry.index - 1]?.term !== entry.term) {
        // Conflict: remove conflicting entry and all after it
        this.raftState.log.splice(entry.index - 1);
        this.raftState.log.push(entry);
      }
    }

    // Update commit index
    if (leaderCommit > this.raftState.commitIndex) {
      this.raftState.commitIndex = Math.min(
        leaderCommit,
        this.getLastLogIndex()
      );
      await this.applyCommittedEntries();
    }

    return { term: this.raftState.currentTerm, success: true, matchIndex };
  }

  /**
   * Propose new entry to be replicated
   * Only leader can propose
   */
  async proposeEntry(
    type: LogEntryType,
    data: Record<string, any>
  ): Promise<{ success: boolean; index?: number; error?: string }> {
    if (this.state !== NodeState.LEADER) {
      return {
        success: false,
        error: `Not leader (state: ${this.state})`,
      };
    }

    const entry: LogEntry = {
      term: this.raftState.currentTerm,
      index: this.getLastLogIndex() + 1,
      type,
      data,
      timestamp: Date.now(),
    };

    this.raftState.log.push(entry);
    this.logger.info({ entry }, "Proposed new log entry");

    return { success: true, index: entry.index };
  }

  /**
   * Become a candidate and start election
   */
  private async startElection(): Promise<void> {
    this.state = NodeState.CANDIDATE;
    this.raftState.currentTerm += 1;
    this.raftState.votedFor = this.nodeId;

    this.logger.info(
      { term: this.raftState.currentTerm },
      "Starting election"
    );

    await this.onStateChanged?.(this.state);
  }

  /**
   * Become leader (after winning election)
   */
  private async becomeLeader(): Promise<void> {
    if (this.state === NodeState.LEADER) {
      return; // Already leader
    }

    this.state = NodeState.LEADER;
    this.currentLeader = this.nodeId;

    // Initialize peer states
    const lastLogIndex = this.getLastLogIndex();
    for (const [peerId, peerState] of this.peerStates) {
      peerState.nextIndex = lastLogIndex + 1;
      peerState.matchIndex = 0;
    }

    this.logger.info({ term: this.raftState.currentTerm }, "Became leader");

    await this.onLeaderElected?.(this.nodeId);
    this.startHeartbeat();
  }

  /**
   * Become follower
   */
  private async becomeFollower(): Promise<void> {
    if (this.state === NodeState.FOLLOWER) {
      return;
    }

    this.clearTimers();
    this.state = NodeState.FOLLOWER;
    this.logger.info("Became follower");

    await this.onStateChanged?.(this.state);
    this.resetElectionTimer();
  }

  /**
   * Send heartbeat to all followers
   */
  private startHeartbeat(): void {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = setInterval(() => {
      if (this.state === NodeState.LEADER) {
        this.sendHeartbeats().catch((err) =>
          this.logger.error(err, "Heartbeat error")
        );
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Send heartbeat to all followers
   */
  private async sendHeartbeats(): Promise<void> {
    // In production, this would send RPC calls to all followers
    // For now, simulate with logging
    this.logger.debug(
      { term: this.raftState.currentTerm, peers: this.peerStates.size },
      "Sending heartbeats"
    );
  }

  /**
   * Apply committed entries to state machine
   */
  private async applyCommittedEntries(): Promise<void> {
    while (this.raftState.lastApplied < this.raftState.commitIndex) {
      this.raftState.lastApplied += 1;
      const entry = this.raftState.log[this.raftState.lastApplied - 1];

      if (entry) {
        this.logger.info(
          { index: entry.index, type: entry.type },
          "Applying entry"
        );
        await this.onEntryCommitted?.(entry);
      }
    }
  }

  /**
   * Reset election timer
   */
  private resetElectionTimer(): void {
    this.clearElectionTimer();

    // Random timeout between min and max
    const timeout =
      Math.random() *
        (this.config.electionTimeoutMax - this.config.electionTimeoutMin) +
      this.config.electionTimeoutMin;

    this.electionTimer = setTimeout(() => {
      if (this.state !== NodeState.LEADER) {
        this.startElection().catch((err) =>
          this.logger.error(err, "Election error")
        );
      }
    }, timeout);
  }

  /**
   * Clear timers
   */
  private clearTimers(): void {
    this.clearElectionTimer();
    this.clearHeartbeatTimer();
  }

  private clearElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = undefined;
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Get last log term
   */
  private getLastLogTerm(): number {
    if (this.raftState.log.length === 0) {
      return 0;
    }
    return this.raftState.log[this.raftState.log.length - 1].term;
  }

  /**
   * Get last log index
   */
  private getLastLogIndex(): number {
    return this.raftState.log.length;
  }

  // Setters for callbacks
  setLeaderElectedCallback(
    callback: (leaderId: string) => Promise<void>
  ): void {
    this.onLeaderElected = callback;
  }

  setEntryCommittedCallback(
    callback: (entry: LogEntry) => Promise<void>
  ): void {
    this.onEntryCommitted = callback;
  }

  setStateChangedCallback(
    callback: (newState: NodeState) => Promise<void>
  ): void {
    this.onStateChanged = callback;
  }

  // Getters
  getState(): NodeState {
    return this.state;
  }

  getCurrentTerm(): number {
    return this.raftState.currentTerm;
  }

  getCurrentLeader(): string | undefined {
    return this.currentLeader;
  }

  getLog(): LogEntry[] {
    return [...this.raftState.log];
  }
}

/**
 * Raft Cluster Manager
 * Manages multiple RAFT nodes for constellation consensus
 */
export class RaftCluster {
  private nodes: Map<string, RaftNode>;
  private logger = pino();

  constructor() {
    this.nodes = new Map();
  }

  /**
   * Add a node to the cluster
   */
  addNode(nodeId: string, otherNodeIds: string[]): RaftNode {
    const node = new RaftNode(nodeId, otherNodeIds);
    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Start all nodes
   */
  async startAll(): Promise<void> {
    await Promise.all(
      Array.from(this.nodes.values()).map((node) => node.start())
    );
  }

  /**
   * Shut down all nodes
   */
  async shutdownAll(): Promise<void> {
    await Promise.all(
      Array.from(this.nodes.values()).map((node) => node.shutdown())
    );
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): RaftNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get cluster leader
   */
  getLeader(): string | undefined {
    for (const node of this.nodes.values()) {
      if (node.getState() === NodeState.LEADER) {
        return node.getCurrentLeader();
      }
    }
    return undefined;
  }

  /**
   * Get cluster stats
   */
  getStats(): {
    totalNodes: number;
    leaders: string[];
    followers: string[];
    candidates: string[];
    logLengths: Record<string, number>;
  } {
    const leaders: string[] = [];
    const followers: string[] = [];
    const candidates: string[] = [];
    const logLengths: Record<string, number> = {};

    for (const [nodeId, node] of this.nodes) {
      const state = node.getState();
      if (state === NodeState.LEADER) {
        leaders.push(nodeId);
      } else if (state === NodeState.FOLLOWER) {
        followers.push(nodeId);
      } else {
        candidates.push(nodeId);
      }
      logLengths[nodeId] = node.getLog().length;
    }

    return {
      totalNodes: this.nodes.size,
      leaders,
      followers,
      candidates,
      logLengths,
    };
  }
}
