/**
 * Smart Contracts for Resource Management
 *
 * Autonomous contracts for:
 * - Resource allocation agreements
 * - Service level agreements (SLAs)
 * - Resource marketplace transactions
 * - Penalties and rewards
 * - Inter-constellation federation agreements
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
  provider: string; // Satellite/Constellation
  consumer: string; // Requesting satellite/constellation
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  startTime: number;
  endTime: number;
  uptime: number; // Required uptime percentage
  latencyMs: number; // Max acceptable latency
  throughputMbps: number; // Min acceptable throughput
  price: number; // Token cost per unit
  penalty: number; // Penalty for breach per hour
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
 * Smart Contract Engine
 */
export class SmartContractEngine {
  private logger = pino();
  private contracts: Map<string, ServiceLevelAgreement>;
  private executions: Map<string, ContractExecution>;
  private transactionHistory: MarketplaceTransaction[];
  private listings: Map<string, MarketplaceListing>;
  private tokenBalance: Map<string, number>; // Simulated token ledger

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
  createServiceAgreement(sla: Omit<ServiceLevelAgreement, "slaId" | "state">): ServiceLevelAgreement {
    const slaId = crypto.randomUUID();

    const contract: ServiceLevelAgreement = {
      slaId,
      ...sla,
      state: ContractState.PENDING,
    };

    this.contracts.set(slaId, contract);

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
      this.logger.warn({ slaId, state: contract.state }, "Contract already activated or terminated");
      return false;
    }

    contract.state = ContractState.ACTIVE;
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
      bonus = contract.penalty * 0.2; // 20% of penalty as bonus
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

    // Update token balances
    this.updateTokenBalance(contract.provider, contract.price * contract.quantity - penalty + bonus);
    this.updateTokenBalance(contract.consumer, -(contract.price * contract.quantity - penalty));

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
   * Get all contracts for entity
   */
  getContractsForEntity(address: string): ServiceLevelAgreement[] {
    const contracts: ServiceLevelAgreement[] = [];

    for (const contract of this.contracts.values()) {
      if (contract.provider === address || contract.consumer === address) {
        contracts.push(contract);
      }
    }

    return contracts;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(slaId: string): ContractExecution[] {
    const executions: ContractExecution[] = [];

    for (const execution of this.executions.values()) {
      if (execution.contractId === slaId) {
        executions.push(execution);
      }
    }

    return executions;
  }

  /**
   * Get marketplace transaction history
   */
  getTransactionHistory(buyer?: string, seller?: string): MarketplaceTransaction[] {
    return this.transactionHistory.filter((t) => {
      if (buyer && t.buyer !== buyer) return false;
      if (seller && t.seller !== seller) return false;
      return true;
    });
  }

  /**
   * Get available listings
   */
  getAvailableListings(resourceType?: ResourceType): MarketplaceListing[] {
    const listings: MarketplaceListing[] = [];

    for (const listing of this.listings.values()) {
      if (!listing.available) continue;
      if (listing.expiresAt < Date.now()) continue;
      if (resourceType && listing.resourceType !== resourceType) continue;

      listings.push(listing);
    }

    return listings;
  }

  /**
   * Get contract statistics
   */
  getStatistics(): {
    totalContracts: number;
    activeContracts: number;
    fulfilledContracts: number;
    breachedContracts: number;
    totalTokensTraded: number;
    averagePenalty: number;
    totalTransactions: number;
  } {
    let activeCount = 0;
    let fulfilledCount = 0;
    let breachedCount = 0;
    let totalTokens = 0;
    let totalPenalties = 0;

    for (const contract of this.contracts.values()) {
      if (contract.state === ContractState.ACTIVE) activeCount++;
      if (contract.state === ContractState.FULFILLED) fulfilledCount++;
      if (contract.state === ContractState.BREACHED) breachedCount++;
    }

    for (const execution of this.executions.values()) {
      totalPenalties += execution.penalty;
    }

    for (const transaction of this.transactionHistory) {
      totalTokens += transaction.totalPrice;
    }

    return {
      totalContracts: this.contracts.size,
      activeContracts: activeCount,
      fulfilledContracts: fulfilledCount,
      breachedContracts: breachedCount,
      totalTokensTraded: totalTokens,
      averagePenalty:
        this.executions.size > 0
          ? totalPenalties / this.executions.size
          : 0,
      totalTransactions: this.transactionHistory.length,
    };
  }
}

export default SmartContractEngine;
