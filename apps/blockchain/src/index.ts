/**
 * Blockchain Integration Service
 *
 * Combines audit logging and smart contracts for:
 * - Immutable transaction records
 * - Autonomous resource management
 * - Federation governance
 * - Trust and verification
 */

import express, { Express, Request, Response } from "express";
import pino from "pino";
import { randomUUID } from "crypto";

import {
  BlockchainAudit,
  AuditEventType,
  AuditEvent,
} from "./audit/blockchain-audit";
import {
  SmartContractEngine,
  ResourceType,
  ContractState,
} from "./contracts/resource-contracts";

/**
 * Blockchain Integration Service
 */
export class BlockchainService {
  private app: Express;
  private logger = pino();
  private audit: BlockchainAudit;
  private contracts: SmartContractEngine;
  private serviceId: string;

  constructor(private port: number = 3008) {
    this.app = express();
    this.serviceId = randomUUID();
    this.audit = new BlockchainAudit();
    this.contracts = new SmartContractEngine();

    this.setupMiddleware();
    this.setupRoutes();
    this.initializeSampleData();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use((req, res, next) => {
      req.id = randomUUID();
      this.logger.info(
        { method: req.method, path: req.path, requestId: req.id },
        "Incoming request"
      );
      next();
    });
  }

  /**
   * Initialize with sample data
   */
  private initializeSampleData(): void {
    // Create some initial token balances
    const satellites = ["SAT-001", "SAT-002", "SAT-003"];
    for (const sat of satellites) {
      this.contracts["tokenBalance"].set(sat, 10000); // Initial balance
    }

    // Create sample marketplace listings
    for (const sat of satellites) {
      this.contracts.createListing({
        seller: sat,
        resourceType: ResourceType.BANDWIDTH,
        quantity: 100, // Mbps
        unit: "Mbps",
        pricePerUnit: 0.5,
        available: true,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000, // 24 hours
      });
    }

    this.logger.info("Sample blockchain data initialized");
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.json({
        status: "healthy",
        serviceId: this.serviceId,
        blockchainBlocks: this.audit.getChain().length,
        activeContracts: this.contracts.getStatistics().activeContracts,
      });
    });

    // === AUDIT LOG ROUTES ===

    // Add audit event
    this.app.post("/audit/events", (req: Request, res: Response) => {
      const { type, satelliteId, details, severity = "medium", source } = req.body;

      if (!type || !source) {
        return res.status(400).json({
          error: "type and source are required",
        });
      }

      const event: AuditEvent = {
        eventId: randomUUID(),
        type: type as AuditEventType,
        timestamp: Date.now(),
        satelliteId,
        details: details || {},
        severity: severity as "low" | "medium" | "high" | "critical",
        source,
      };

      this.audit.addEvent(event);

      res.json({
        status: "added",
        eventId: event.eventId,
        timestamp: event.timestamp,
      });
    });

    // Get blockchain chain
    this.app.get("/audit/chain", (req: Request, res: Response) => {
      const chain = this.audit.getChain();
      res.json({
        blockCount: chain.length,
        blocks: chain.map((b) => ({
          blockNumber: b.blockNumber,
          eventCount: b.eventCount,
          timestamp: b.timestamp,
          blockHash: b.blockHash,
          merkleRoot: b.merkleRoot,
        })),
      });
    });

    // Get specific block
    this.app.get("/audit/blocks/:blockNumber", (req: Request, res: Response) => {
      const block = this.audit.getBlock(parseInt(req.params.blockNumber));

      if (!block) {
        return res.status(404).json({ error: "Block not found" });
      }

      res.json({
        block: {
          blockNumber: block.blockNumber,
          eventCount: block.eventCount,
          timestamp: block.timestamp,
          blockHash: block.blockHash,
          previousHash: block.previousHash,
          merkleRoot: block.merkleRoot,
        },
        events: block.events,
      });
    });

    // Get events by type
    this.app.get("/audit/events", (req: Request, res: Response) => {
      const { type, satelliteId, eventType } = req.query;

      let events = [];

      if (eventType) {
        events = this.audit.getEventsByType(eventType as AuditEventType);
      } else if (satelliteId) {
        events = this.audit.getSatelliteEvents(satelliteId as string);
      } else {
        // All events
        for (const block of this.audit.getChain()) {
          events.push(...block.events);
        }
      }

      res.json({
        count: events.length,
        events: events.slice(0, 1000), // Limit response
      });
    });

    // Get events in time range
    this.app.post("/audit/events-time", (req: Request, res: Response) => {
      const { startTime, endTime } = req.body;

      if (startTime === undefined || endTime === undefined) {
        return res.status(400).json({
          error: "startTime and endTime are required",
        });
      }

      const events = this.audit.getEventsByTimeRange(startTime, endTime);

      res.json({
        timeRange: { startTime, endTime },
        count: events.length,
        events: events.slice(0, 1000),
      });
    });

    // Verify chain integrity
    this.app.get("/audit/verify", (req: Request, res: Response) => {
      const verification = this.audit.verifyChainIntegrity();

      res.json({
        isValid: verification.isValid,
        blockCount: this.audit.getChain().length,
        errors: verification.errors,
      });
    });

    // Get audit statistics
    this.app.get("/audit/stats", (req: Request, res: Response) => {
      const stats = this.audit.getStatistics();
      res.json(stats);
    });

    // Force block creation
    this.app.post("/audit/create-block", (req: Request, res: Response) => {
      this.audit.forceBlockCreation();

      const chain = this.audit.getChain();
      const latestBlock = chain[chain.length - 1];

      res.json({
        status: "block_created",
        blockNumber: latestBlock.blockNumber,
        blockHash: latestBlock.blockHash,
        eventCount: latestBlock.eventCount,
      });
    });

    // Export audit snapshot
    this.app.get("/audit/export", (req: Request, res: Response) => {
      const snapshot = this.audit.exportSnapshot();
      res.json(snapshot);
    });

    // === SMART CONTRACT ROUTES ===

    // Create service agreement
    this.app.post("/contracts/sla", (req: Request, res: Response) => {
      const {
        provider,
        consumer,
        resourceType,
        quantity,
        unit,
        startTime,
        endTime,
        uptime = 99.5,
        latencyMs = 100,
        throughputMbps = 10,
        price = 1.0,
        penalty = 10.0,
      } = req.body;

      if (!provider || !consumer || !resourceType) {
        return res.status(400).json({
          error: "provider, consumer, and resourceType are required",
        });
      }

      const sla = this.contracts.createServiceAgreement({
        provider,
        consumer,
        resourceType: resourceType as ResourceType,
        quantity,
        unit,
        startTime: startTime || Date.now(),
        endTime: endTime || Date.now() + 86400000,
        uptime,
        latencyMs,
        throughputMbps,
        price,
        penalty,
      });

      // Log to audit
      this.audit.addEvent({
        eventId: randomUUID(),
        type: AuditEventType.CONFIGURATION_CHANGE,
        timestamp: Date.now(),
        details: {
          action: "sla_created",
          slaId: sla.slaId,
          provider,
          consumer,
          resource: resourceType,
        },
        severity: "medium",
        source: "blockchain-contracts",
      });

      res.json({
        status: "created",
        slaId: sla.slaId,
        state: sla.state,
      });
    });

    // Activate contract
    this.app.post("/contracts/:slaId/activate", (req: Request, res: Response) => {
      const success = this.contracts.activateContract(req.params.slaId);

      if (!success) {
        return res.status(400).json({ error: "Failed to activate contract" });
      }

      this.audit.addEvent({
        eventId: randomUUID(),
        type: AuditEventType.CONFIGURATION_CHANGE,
        timestamp: Date.now(),
        details: {
          action: "sla_activated",
          slaId: req.params.slaId,
        },
        severity: "low",
        source: "blockchain-contracts",
      });

      res.json({ status: "activated", slaId: req.params.slaId });
    });

    // Report contract execution
    this.app.post("/contracts/:slaId/report", (req: Request, res: Response) => {
      const { uptimePercent, averageLatencyMs, averageThroughputMbps } =
        req.body;

      if (
        uptimePercent === undefined ||
        averageLatencyMs === undefined ||
        averageThroughputMbps === undefined
      ) {
        return res.status(400).json({
          error: "All metrics are required",
        });
      }

      const execution = this.contracts.reportExecution(req.params.slaId, {
        uptimePercent,
        averageLatencyMs,
        averageThroughputMbps,
      });

      if (!execution) {
        return res.status(404).json({ error: "Contract not found" });
      }

      this.audit.addEvent({
        eventId: randomUUID(),
        type: AuditEventType.CONFIGURATION_CHANGE,
        timestamp: Date.now(),
        details: {
          action: "sla_execution_reported",
          slaId: req.params.slaId,
          status: execution.status,
          penalty: execution.penalty,
          bonus: execution.performanceBonus,
        },
        severity: execution.penalty > 0 ? "high" : "low",
        source: "blockchain-contracts",
      });

      res.json({
        executionId: execution.executionId,
        status: execution.status,
        penalty: execution.penalty.toFixed(2),
        bonus: execution.performanceBonus.toFixed(2),
      });
    });

    // Get contract
    this.app.get("/contracts/:slaId", (req: Request, res: Response) => {
      const contract = this.contracts.getContract(req.params.slaId);

      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }

      res.json(contract);
    });

    // Get contracts for entity
    this.app.get("/contracts-for/:address", (req: Request, res: Response) => {
      const contracts = this.contracts.getContractsForEntity(req.params.address);

      res.json({
        address: req.params.address,
        count: contracts.length,
        contracts: contracts.map((c) => ({
          slaId: c.slaId,
          role: c.provider === req.params.address ? "provider" : "consumer",
          resource: c.resourceType,
          state: c.state,
          startTime: c.startTime,
          endTime: c.endTime,
        })),
      });
    });

    // Create marketplace listing
    this.app.post("/marketplace/listings", (req: Request, res: Response) => {
      const {
        seller,
        resourceType,
        quantity,
        unit,
        pricePerUnit,
        expiresAt,
      } = req.body;

      if (!seller || !resourceType || !quantity) {
        return res.status(400).json({
          error: "seller, resourceType, and quantity are required",
        });
      }

      const listing = this.contracts.createListing({
        seller,
        resourceType: resourceType as ResourceType,
        quantity,
        unit: unit || "unit",
        pricePerUnit: pricePerUnit || 1.0,
        available: true,
        createdAt: Date.now(),
        expiresAt: expiresAt || Date.now() + 86400000,
      });

      res.json({
        status: "created",
        listingId: listing.listingId,
        seller,
        resourceType,
        quantity,
      });
    });

    // Get available listings
    this.app.get("/marketplace/listings", (req: Request, res: Response) => {
      const listings = this.contracts.getAvailableListings();

      res.json({
        count: listings.length,
        listings: listings.map((l) => ({
          listingId: l.listingId,
          seller: l.seller,
          resourceType: l.resourceType,
          quantity: l.quantity,
          unit: l.unit,
          pricePerUnit: l.pricePerUnit,
          totalValue: l.quantity * l.pricePerUnit,
        })),
      });
    });

    // Execute marketplace transaction
    this.app.post("/marketplace/buy", (req: Request, res: Response) => {
      const { listingId, buyer, quantity } = req.body;

      if (!listingId || !buyer || !quantity) {
        return res.status(400).json({
          error: "listingId, buyer, and quantity are required",
        });
      }

      const transaction = this.contracts.executeTransaction(
        listingId,
        buyer,
        quantity
      );

      if (!transaction) {
        return res.status(400).json({ error: "Transaction failed" });
      }

      this.audit.addEvent({
        eventId: randomUUID(),
        type: AuditEventType.COMMUNICATION_EVENT,
        timestamp: Date.now(),
        details: {
          action: "marketplace_transaction",
          transactionId: transaction.transactionId,
          buyer,
          seller: transaction.seller,
          resource: transaction.resourceType,
          quantity,
          totalPrice: transaction.totalPrice,
        },
        severity: "low",
        source: "blockchain-marketplace",
      });

      res.json({
        transactionId: transaction.transactionId,
        status: transaction.status,
        buyer,
        seller: transaction.seller,
        quantity,
        totalPrice: transaction.totalPrice,
      });
    });

    // Get token balance
    this.app.get("/tokens/:address", (req: Request, res: Response) => {
      const balance = this.contracts.getTokenBalance(req.params.address);
      res.json({
        address: req.params.address,
        balance: balance.toFixed(2),
      });
    });

    // Get transaction history
    this.app.get("/marketplace/transactions", (req: Request, res: Response) => {
      const { buyer, seller } = req.query;
      const transactions = this.contracts.getTransactionHistory(
        buyer as string,
        seller as string
      );

      res.json({
        count: transactions.length,
        transactions: transactions.map((t) => ({
          transactionId: t.transactionId,
          buyer: t.buyer,
          seller: t.seller,
          resource: t.resourceType,
          quantity: t.quantity,
          totalPrice: t.totalPrice,
          status: t.status,
          timestamp: t.timestamp,
        })),
      });
    });

    // Get smart contract statistics
    this.app.get("/contracts/stats", (req: Request, res: Response) => {
      const stats = this.contracts.getStatistics();
      res.json(stats);
    });

    // Combined blockchain statistics
    this.app.get("/stats", (req: Request, res: Response) => {
      const auditStats = this.audit.getStatistics();
      const contractStats = this.contracts.getStatistics();

      res.json({
        audit: auditStats,
        contracts: contractStats,
        combined: {
          totalEvents: auditStats.totalEvents + contractStats.totalTransactions,
          systemTrust: (contractStats.fulfilledContracts /
            (contractStats.fulfilledContracts +
              contractStats.breachedContracts +
              1)) *
            100,
        },
      });
    });
  }

  /**
   * Start service
   */
  start(): void {
    this.app.listen(this.port, () => {
      this.logger.info(
        {
          port: this.port,
          serviceId: this.serviceId,
          blockchainBlocks: this.audit.getChain().length,
        },
        "Blockchain Service started"
      );
    });
  }
}

// Export service
export default BlockchainService;

// Start if run directly
if (require.main === module) {
  const service = new BlockchainService(3008);
  service.start();
}
