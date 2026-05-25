/**
 * Smart Contracts - Optimized
 *
 * Uses optimization algorithms for:
 * - O(n) single-pass statistics calculation instead of multiple iterations
 * - Efficient contract and listing filtering
 * - Cached marketplace statistics
 */

import pino from "pino";
import crypto from "crypto";

/**
 * Contract state
 */
export enum ContractState {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  FULFILLED = "FULFILLED",
  BREACHED = "BREACHED",
  TERMINATED = "TERMINATED",
}

/**
 * Resource type
 */
export enum ResourceType {
  BANDWIDTH = "BANDWIDTH",
  STORAGE = "STORAGE",
  COMPUTATION = "COMPUTATION",
  POWER = "POWER",
  THERMAL_CAPACITY = "THERMAL_CAPACITY",
  ISL_LINK = "ISL_LINK",
}

/**
 * Service Agreement
 */
export interface ServiceLevelAgreement {
  slaId: string;
  provider: string;
  consumer: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  startTime: number;
  endTime: number;
  uptime: number;
  latencyMs: number;
  throughputMbps: number;
  price: number;
  penalty: number;
  state: ContractState;
}

/**
 * Marketplace Listing
 */
export interface MarketplaceListing {
  listingId: string;
  seller: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  available: boolean;
  createdAt: number;
  expiresAt: number;
}

/**
 * Marketplace Transaction
 */
export interface MarketplaceTransaction {
  transactionId: string;
  listingId: string;
  buyer: string;
  seller: string;
  resourceType: ResourceType;
  quantity: number;
  totalPrice: number;
  status: "pending" | "confirmed" | "completed" | "failed";
  timestamp: number;
  completionTime?: number;
}

/**
 * Contract Execution
 */
export interface ContractExecution {
  executionId: string;
  contractId: string;
  provider: string;
  consumer: string;
  startTime: number;
  endTime: number;
  metricsReported: {
    uptimePercent: number;
    averageLatencyMs: number;
    averageThroughputMbps: number;
  };
  performanceBonus: number;
  penalty: number;
  status: "success" | "partial" | "failed";
}

/**
 * Cached statistics
 */
interface CachedStatistics {
  totalContracts: number;
  activeContracts: number;
  fulfilledContracts: number;
  breachedContracts: number;
  totalTokensTraded: number;
  averagePenalty: number;
  totalTransactions: number;
  lastUpdated: number;
}

/**
 * Smart Contract Engine - Optimized
 */
export class SmartContractEngineOptimized {
  private logger = pino();
  private contracts: Map<string, ServiceLevelAgreement>;
  private executions: Map<string, ContractExecution>;
  private transactionHistory: MarketplaceTransaction[];
  private listings: Map<string, MarketplaceListing>;
  private tokenBalance: Map<string, number>;
  private cachedStatistics: CachedStatistics | null = null;

  // Performance metrics
  private metrics = {
    totalQueries: 0,
    cachedHits: 0,
    avgQueryTimeMs: 0,
    transactionsProcessed: 0,
  };

  constructor() {
    this.contracts = new Map();
    this.executions = new Map();
    this.transactionHistory = [];
    this.listings = new Map();
    this.tokenBalance = new Map();
  }

  /**
   * Create new SLA contract
   */
  createServiceAgreement(
    sla: Omit<ServiceLevelAgreement, "slaId" | "state">
  ): ServiceLevelAgreement {
    const slaId = crypto.randomUUID();

    const contract: ServiceLevelAgreement = {
      slaId,
      ...sla,
      state: ContractState.PENDING,
    };

    this.contracts.set(slaId, contract);
    this.invalidateStatisticsCache();

    this.logger.info(
      {
        slaId,
        provider: sla.provider,
        consumer: sla.consumer,
        resource: sla.resourceType,
      },
      "Service agreement created"
    );

    return contract;
  }

  /**
   * Activate contract
   */
  activateContract(slaId: string): boolean {
    const contract = this.contracts.get(slaId);
    if (!contract) {
      this.logger.warn({ slaId }, "Contract not found");
      return false;
    }

    if (contract.state !== ContractState.PENDING) {
      this.logger.warn(
        { slaId, state: contract.state },
        "Contract already activated or terminated"
      );
      return false;
    }

    contract.state = ContractState.ACTIVE;
    this.invalidateStatisticsCache();

    this.logger.info({ slaId }, "Contract activated");

    return true;
  }

  /**
   * Report contract execution metrics
   */
  reportExecution(
    slaId: string,
    metrics: {
      uptimePercent: number;
      averageLatencyMs: number;
      averageThroughputMbps: number;
    }
  ): ContractExecution | null {
    const contract = this.contracts.get(slaId);
    if (!contract) {
      this.logger.warn({ slaId }, "Contract not found");
      return null;
    }

    const executionId = crypto.randomUUID();
    const now = Date.now();

    // Evaluate performance
    let status: "success" | "partial" | "failed" = "success";
    let penalty = 0;
    let bonus = 0;

    // Check uptime
    if (metrics.uptimePercent < contract.uptime * 0.95) {
      status = "failed";
      penalty += contract.penalty * ((contract.uptime * 0.95 - metrics.uptimePercent) / 100);
    }

    // Check latency
    if (metrics.averageLatencyMs > contract.latencyMs * 1.5) {
      status = "partial";
      penalty += contract.penalty * 0.5;
    }

    // Check throughput
    if (metrics.averageThroughputMbps < contract.throughputMbps * 0.9) {
      status = "partial";
      penalty += contract.penalty * 0.3;
    }

    // Calculate bonus for exceeding expectations
    if (
      metrics.uptimePercent > contract.uptime + 2 &&
      metrics.averageLatencyMs < contract.latencyMs * 0.8 &&
      metrics.averageThroughputMbps > contract.throughputMbps * 1.1
    ) {
      bonus = contract.penalty * 0.2;
    }

    // Update contract status
    if (status === "failed") {
      contract.state = ContractState.BREACHED;
    } else if (now > contract.endTime) {
      contract.state = ContractState.FULFILLED;
    }

    const execution: ContractExecution = {
      executionId,
      contractId: slaId,
      provider: contract.provider,
      consumer: contract.consumer,
      startTime: contract.startTime,
      endTime: contract.endTime,
      metricsReported: metrics,
      performanceBonus: bonus,
      penalty,
      status,
    };

    this.executions.set(executionId, execution);
    this.invalidateStatisticsCache();

    // Update token balances
    this.updateTokenBalance(
      contract.provider,
      contract.price * contract.quantity - penalty + bonus
    );
    this.updateTokenBalance(
      contract.consumer,
      -(contract.price * contract.quantity - penalty)
    );

    this.logger.info(
      {
        executionId,
        slaId,
        status,
        penalty: penalty.toFixed(2),
        bonus: bonus.toFixed(2),
      },
      "Contract execution reported"
    );

    return execution;
  }

  /**
   * Create marketplace listing
   */
  createListing(listing: Omit<MarketplaceListing, "listingId">): MarketplaceListing {
    const listingId = crypto.randomUUID();

    const marketplaceListing: MarketplaceListing = {
      listingId,
      ...listing,
    };

    this.listings.set(listingId, marketplaceListing);
    this.invalidateStatisticsCache();

    this.logger.info(
      {
        listingId,
        seller: listing.seller,
        resource: listing.resourceType,
        quantity: listing.quantity,
      },
      "Marketplace listing created"
    );

    return marketplaceListing;
  }

  /**
   * Execute marketplace transaction
   */
  executeTransaction(
    listingId: string,
    buyer: string,
    quantity: number
  ): MarketplaceTransaction | null {
    const listing = this.listings.get(listingId);
    if (!listing) {
      this.logger.warn({ listingId }, "Listing not found");
      return null;
    }

    if (quantity > listing.quantity || !listing.available) {
      this.logger.warn(
        { listingId, requested: quantity, available: listing.quantity },
        "Insufficient resources"
      );
      return null;
    }

    const transactionId = crypto.randomUUID();
    const totalPrice = quantity * listing.pricePerUnit;

    // Check buyer balance
    const buyerBalance = this.tokenBalance.get(buyer) || 0;
    if (buyerBalance < totalPrice) {
      this.logger.warn(
        { buyer, required: totalPrice, balance: buyerBalance },
        "Insufficient funds"
      );
      return null;
    }

    const transaction: MarketplaceTransaction = {
      transactionId,
      listingId,
      buyer,
      seller: listing.seller,
      resourceType: listing.resourceType,
      quantity,
      totalPrice,
      status: "pending",
      timestamp: Date.now(),
    };

    // Update balances
    this.updateTokenBalance(buyer, -totalPrice);
    this.updateTokenBalance(listing.seller, totalPrice);

    // Update listing
    listing.quantity -= quantity;
    if (listing.quantity === 0) {
      listing.available = false;
    }

    this.transactionHistory.push(transaction);
    transaction.status = "completed";
    transaction.completionTime = Date.now();

    this.metrics.transactionsProcessed++;
    this.invalidateStatisticsCache();

    this.logger.info(
      {
        transactionId,
        buyer,
        seller: listing.seller,
        quantity,
        totalPrice,
      },
      "Marketplace transaction completed"
    );

    return transaction;
  }

  /**
   * Update token balance
   */
  private updateTokenBalance(address: string, delta: number): void {
    const currentBalance = this.tokenBalance.get(address) || 0;
    const newBalance = currentBalance + delta;
    this.tokenBalance.set(address, newBalance);
  }

  /**
   * Get token balance
   */
  getTokenBalance(address: string): number {
    return this.tokenBalance.get(address) || 0;
  }

  /**
   * Get contract
   */
  getContract(slaId: string): ServiceLevelAgreement | undefined {
    return this.contracts.get(slaId);
  }

  /**
   * Get all contracts for entity - single-pass filtering
   */
  getContractsForEntityOptimized(address: string): ServiceLevelAgreement[] {
    const contracts: ServiceLevelAgreement[] = [];

    // Single-pass iteration with early termination if needed
    for (const contract of this.contracts.values()) {
      if (contract.provider === address || contract.consumer === address) {
        contracts.push(contract);
      }
    }

    return contracts;
  }

  /**
   * Get execution history - single-pass filtering
   */
  getExecutionHistoryOptimized(slaId: string): ContractExecution[] {
    const executions: ContractExecution[] = [];

    // Single-pass iteration
    for (const execution of this.executions.values()) {
      if (execution.contractId === slaId) {
        executions.push(execution);
      }
    }

    return executions;
  }

  /**
   * Get marketplace transaction history - optimized filtering
   */
  getTransactionHistoryOptimized(
    buyer?: string,
    seller?: string
  ): MarketplaceTransaction[] {
    const results: MarketplaceTransaction[] = [];

    // Single-pass filtering
    for (const transaction of this.transactionHistory) {
      if (buyer && transaction.buyer !== buyer) continue;
      if (seller && transaction.seller !== seller) continue;
      results.push(transaction);
    }

    return results;
  }

  /**
   * Get available listings - optimized filtering
   */
  getAvailableListingsOptimized(resourceType?: ResourceType): MarketplaceListing[] {
    const listings: MarketplaceListing[] = [];
    const now = Date.now();

    // Single-pass iteration with all conditions checked
    for (const listing of this.listings.values()) {
      if (!listing.available) continue;
      if (listing.expiresAt < now) continue;
      if (resourceType && listing.resourceType !== resourceType) continue;

      listings.push(listing);
    }

    return listings;
  }

  /**
   * Invalidate statistics cache
   */
  private invalidateStatisticsCache(): void {
    this.cachedStatistics = null;
  }

  /**
   * Get contract statistics - single-pass calculation with caching
   */
  getStatisticsOptimized(): {
    totalContracts: number;
    activeContracts: number;
    fulfilledContracts: number;
    breachedContracts: number;
    totalTokensTraded: number;
    averagePenalty: number;
    totalTransactions: number;
  } {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    // Check cache validity (valid for 5 seconds)
    if (
      this.cachedStatistics &&
      Date.now() - this.cachedStatistics.lastUpdated < 5000
    ) {
      this.metrics.cachedHits++;
      return {
        totalContracts: this.cachedStatistics.totalContracts,
        activeContracts: this.cachedStatistics.activeContracts,
        fulfilledContracts: this.cachedStatistics.fulfilledContracts,
        breachedContracts: this.cachedStatistics.breachedContracts,
        totalTokensTraded: this.cachedStatistics.totalTokensTraded,
        averagePenalty: this.cachedStatistics.averagePenalty,
        totalTransactions: this.cachedStatistics.totalTransactions,
      };
    }

    // Single-pass calculation combining all statistics
    let activeCount = 0;
    let fulfilledCount = 0;
    let breachedCount = 0;
    let totalPenalties = 0;
    let totalTokens = 0;

    // Count contract states (single pass)
    for (const contract of this.contracts.values()) {
      if (contract.state === ContractState.ACTIVE) activeCount++;
      else if (contract.state === ContractState.FULFILLED) fulfilledCount++;
      else if (contract.state === ContractState.BREACHED) breachedCount++;
    }

    // Sum penalties (single pass)
    for (const execution of this.executions.values()) {
      totalPenalties += execution.penalty;
    }

    // Sum transaction values (single pass)
    for (const transaction of this.transactionHistory) {
      totalTokens += transaction.totalPrice;
    }

    // Create cached result
    this.cachedStatistics = {
      totalContracts: this.contracts.size,
      activeContracts: activeCount,
      fulfilledContracts: fulfilledCount,
      breachedContracts: breachedCount,
      totalTokensTraded: totalTokens,
      averagePenalty: this.executions.size > 0 ? totalPenalties / this.executions.size : 0,
      totalTransactions: this.transactionHistory.length,
      lastUpdated: Date.now(),
    };

    // Update metrics
    const queryTime = Date.now() - startTime;
    this.metrics.avgQueryTimeMs =
      (this.metrics.avgQueryTimeMs * (this.metrics.totalQueries - 1) + queryTime) /
      this.metrics.totalQueries;

    return {
      totalContracts: this.cachedStatistics.totalContracts,
      activeContracts: this.cachedStatistics.activeContracts,
      fulfilledContracts: this.cachedStatistics.fulfilledContracts,
      breachedContracts: this.cachedStatistics.breachedContracts,
      totalTokensTraded: this.cachedStatistics.totalTokensTraded,
      averagePenalty: this.cachedStatistics.averagePenalty,
      totalTransactions: this.cachedStatistics.totalTransactions,
    };
  }

  /**
   * Get optimization metrics
   */
  getOptimizationMetrics() {
    const cacheHitRate =
      this.metrics.totalQueries > 0
        ? ((this.metrics.cachedHits / this.metrics.totalQueries) * 100).toFixed(1)
        : "0";

    return {
      totalQueries: this.metrics.totalQueries,
      cachedHits: this.metrics.cachedHits,
      cacheHitRate,
      avgQueryTimeMs: this.metrics.avgQueryTimeMs.toFixed(2),
      transactionsProcessed: this.metrics.transactionsProcessed,
    };
  }
}

export default SmartContractEngineOptimized;
