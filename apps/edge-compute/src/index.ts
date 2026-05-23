/**
 * Edge Compute Service
 * Autonomous ML model execution and training on satellites
 *
 * Features:
 * - Lightweight model inference (thermal, power, anomaly detection)
 * - Federated learning across constellation
 * - Bandwidth-optimized gradient communication
 * - Real-time decision making without ground contact
 */

import express, { Express, Request, Response } from "express";
import pino from "pino";
import { randomUUID } from "crypto";

import {
  EdgeModelRegistry,
  EdgeThermalAnomaly,
  EdgePowerOptimizer,
} from "./models/edge-models";
import {
  FederatedLearningCoordinator,
  GradientCompressor,
  CompressionStrategy,
  ModelGradient,
  SatelliteMetrics,
} from "./communication/federated-learning";

/**
 * Edge Compute Service
 */
export class EdgeComputeService {
  private app: Express;
  private logger = pino();
  private modelRegistry: EdgeModelRegistry;
  private fedLearningCoordinator: FederatedLearningCoordinator;
  private gradientCompressor: GradientCompressor;
  private serviceId: string;
  private inferenceHistory: Array<{
    modelId: string;
    timestamp: number;
    processingTimeMs: number;
    confidence: number;
  }> = [];

  constructor(private port: number = 3006) {
    this.app = express();
    this.serviceId = randomUUID();
    this.modelRegistry = new EdgeModelRegistry();
    this.fedLearningCoordinator = new FederatedLearningCoordinator();
    this.gradientCompressor = new GradientCompressor();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
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
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res.json({
        status: "healthy",
        serviceId: this.serviceId,
        modelCount: this.modelRegistry.listModels().length,
        totalModelSizeKb: this.modelRegistry.getTotalSize(),
      });
    });

    // List available models
    this.app.get("/models", (req: Request, res: Response) => {
      const models = this.modelRegistry.listModels();
      res.json({
        models,
        totalSizeKb: this.modelRegistry.getTotalSize(),
        count: models.length,
      });
    });

    // Get model details
    this.app.get("/models/:modelId", (req: Request, res: Response) => {
      const model = this.modelRegistry.getModel(req.params.modelId);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      res.json(model.getConfig());
    });

    // Run thermal anomaly detection
    this.app.post("/inference/thermal-anomaly", (req: Request, res: Response) => {
      const { thermalData, satelliteId } = req.body;

      if (!thermalData || !Array.isArray(thermalData)) {
        return res
          .status(400)
          .json({ error: "thermalData must be a number array" });
      }

      try {
        const model = this.modelRegistry.getModel(
          "edge-thermal-anomaly-v1"
        ) as EdgeThermalAnomaly;

        if (!model) {
          return res.status(404).json({ error: "Thermal anomaly model not found" });
        }

        const inference = model.detect(thermalData);
        inference.satelliteId = satelliteId || "unknown";

        this.recordInference(inference.modelId, inference.processingTimeMs, inference.confidence);

        res.json({
          anomalyScore: inference.outputData[0],
          isAnomaly: inference.outputData[0] > 0.5,
          confidence: inference.confidence,
          processingTimeMs: inference.processingTimeMs,
          timestamp: inference.timestamp,
        });
      } catch (error) {
        this.logger.error({ error }, "Thermal anomaly detection failed");
        res.status(500).json({ error: "Inference failed" });
      }
    });

    // Run power optimization
    this.app.post("/inference/power-optimize", (req: Request, res: Response) => {
      const { powerState, satelliteId } = req.body;

      if (!powerState) {
        return res
          .status(400)
          .json({ error: "powerState is required" });
      }

      try {
        const model = this.modelRegistry.getModel(
          "edge-power-optimizer-v1"
        ) as EdgePowerOptimizer;

        if (!model) {
          return res.status(404).json({ error: "Power optimizer model not found" });
        }

        const inference = model.optimize(powerState);
        inference.satelliteId = satelliteId || "unknown";

        this.recordInference(inference.modelId, inference.processingTimeMs, inference.confidence);

        res.json({
          allocation: {
            thermalPercent: inference.outputData[0] * 100,
            commsPercent: inference.outputData[1] * 100,
            payloadPercent: inference.outputData[2] * 100,
          },
          processingTimeMs: inference.processingTimeMs,
          confidence: inference.confidence,
          timestamp: inference.timestamp,
        });
      } catch (error) {
        this.logger.error({ error }, "Power optimization failed");
        res.status(500).json({ error: "Optimization failed" });
      }
    });

    // Batch inference
    this.app.post("/inference/batch", (req: Request, res: Response) => {
      const { modelId, inputBatch, satelliteId } = req.body;

      if (!modelId || !inputBatch || !Array.isArray(inputBatch)) {
        return res
          .status(400)
          .json({ error: "modelId and inputBatch array are required" });
      }

      try {
        const results = inputBatch.map((input: any, index: number) => {
          try {
            if (modelId === "edge-thermal-anomaly-v1") {
              const model = this.modelRegistry.getModel(
                modelId
              ) as EdgeThermalAnomaly;
              const inference = model.detect(input);
              return {
                index,
                success: true,
                score: inference.outputData[0],
                processingTimeMs: inference.processingTimeMs,
              };
            } else if (modelId === "edge-power-optimizer-v1") {
              const model = this.modelRegistry.getModel(
                modelId
              ) as EdgePowerOptimizer;
              const inference = model.optimize(input);
              return {
                index,
                success: true,
                allocation: inference.outputData,
                processingTimeMs: inference.processingTimeMs,
              };
            }
          } catch (err) {
            return { index, success: false, error: String(err) };
          }
        });

        res.json({
          modelId,
          batchSize: inputBatch.length,
          successCount: results.filter((r: any) => r.success).length,
          results,
        });
      } catch (error) {
        this.logger.error({ error }, "Batch inference failed");
        res.status(500).json({ error: "Batch inference failed" });
      }
    });

    // Federated learning: Register satellite
    this.app.post("/federated/register", (req: Request, res: Response) => {
      const { satelliteId, modelsToTrain } = req.body;

      if (!satelliteId || !Array.isArray(modelsToTrain)) {
        return res
          .status(400)
          .json({ error: "satelliteId and modelsToTrain array are required" });
      }

      this.fedLearningCoordinator.registerSatellite(satelliteId, modelsToTrain);

      res.json({
        status: "registered",
        satelliteId,
        modelsToTrain,
        timestamp: Date.now(),
      });
    });

    // Federated learning: Submit gradients
    this.app.post("/federated/gradients", (req: Request, res: Response) => {
      const { modelId, epoch, participantId, gradients, loss, sampleCount } =
        req.body;

      if (!modelId || epoch === undefined || !participantId || !gradients) {
        return res
          .status(400)
          .json({
            error: "modelId, epoch, participantId, and gradients are required",
          });
      }

      try {
        const gradient: ModelGradient = {
          modelId,
          epoch,
          participantId,
          timestamp: Date.now(),
          gradients: Array.isArray(gradients) ? gradients : Object.values(gradients),
          loss: loss || 0,
          sampleCount: sampleCount || 1,
          compressed: false,
          compressionRatio: 1.0,
        };

        this.fedLearningCoordinator.submitGradients(gradient);

        res.json({
          status: "received",
          modelId,
          epoch,
          gradientsLength: gradient.gradients.length,
        });
      } catch (error) {
        this.logger.error({ error }, "Gradient submission failed");
        res.status(500).json({ error: "Gradient submission failed" });
      }
    });

    // Federated learning: Aggregate gradients
    this.app.post("/federated/aggregate", (req: Request, res: Response) => {
      const { gradients, method = "fedavg", compression = "none" } = req.body;

      if (!gradients || !Array.isArray(gradients)) {
        return res
          .status(400)
          .json({ error: "gradients array is required" });
      }

      try {
        const aggregated = this.fedLearningCoordinator.aggregateGradients(
          gradients,
          method
        );

        // Compress if requested
        let compressedData: any = null;
        if (compression !== "none") {
          const compressionType = (CompressionStrategy as any)[compression.toUpperCase()] ||
            CompressionStrategy.NONE;
          compressedData = this.gradientCompressor.compress(
            aggregated.aggregatedGradients,
            compressionType
          );
        }

        res.json({
          modelId: aggregated.modelId,
          epoch: aggregated.epoch,
          participantCount: aggregated.participantCount,
          method: aggregated.aggregationMethod,
          confidence: aggregated.confidenceScore,
          aggregatedGradients: aggregated.aggregatedGradients,
          compressed: compressedData,
        });
      } catch (error) {
        this.logger.error({ error }, "Gradient aggregation failed");
        res.status(500).json({ error: "Aggregation failed" });
      }
    });

    // Federated learning: Broadcast update
    this.app.post("/federated/broadcast", (req: Request, res: Response) => {
      const { update, compression = "uint8" } = req.body;

      if (!update) {
        return res.status(400).json({ error: "update is required" });
      }

      try {
        const compressionType = (CompressionStrategy as any)[compression.toUpperCase()] ||
          CompressionStrategy.NONE;

        this.fedLearningCoordinator.broadcastUpdate(update, compressionType);

        res.json({
          status: "broadcast",
          modelId: update.modelId,
          epoch: update.epoch,
          compression,
          timestamp: Date.now(),
        });
      } catch (error) {
        this.logger.error({ error }, "Broadcast failed");
        res.status(500).json({ error: "Broadcast failed" });
      }
    });

    // Federated learning: Get satellite metrics
    this.app.get("/federated/metrics/:satelliteId", (req: Request, res: Response) => {
      const metrics = this.fedLearningCoordinator.getSatelliteMetric(
        req.params.satelliteId
      );

      if (!metrics) {
        return res.status(404).json({ error: "Satellite not found" });
      }

      res.json(metrics);
    });

    // Federated learning: Get all satellite metrics
    this.app.get("/federated/metrics", (req: Request, res: Response) => {
      const metrics = this.fedLearningCoordinator.getSatelliteMetrics();
      res.json({
        count: metrics.length,
        metrics,
      });
    });

    // Federated learning: Get training progress
    this.app.get("/federated/progress/:modelId", (req: Request, res: Response) => {
      const progress = this.fedLearningCoordinator.getTrainingProgress(
        req.params.modelId
      );
      res.json(progress);
    });

    // Federated learning: Get resource utilization
    this.app.get("/federated/resources", (req: Request, res: Response) => {
      const utilization = this.fedLearningCoordinator.getResourceUtilization();
      res.json(utilization);
    });

    // Inference statistics
    this.app.get("/stats", (req: Request, res: Response) => {
      const avgProcessingTime =
        this.inferenceHistory.length > 0
          ? this.inferenceHistory.reduce(
              (sum, r) => sum + r.processingTimeMs,
              0
            ) / this.inferenceHistory.length
          : 0;

      const avgConfidence =
        this.inferenceHistory.length > 0
          ? this.inferenceHistory.reduce(
              (sum, r) => sum + r.confidence,
              0
            ) / this.inferenceHistory.length
          : 0;

      const modelStats = new Map<string, number>();
      for (const record of this.inferenceHistory) {
        modelStats.set(
          record.modelId,
          (modelStats.get(record.modelId) || 0) + 1
        );
      }

      res.json({
        totalInferences: this.inferenceHistory.length,
        averageProcessingTimeMs: avgProcessingTime,
        averageConfidence: avgConfidence,
        inferencesByModel: Object.fromEntries(modelStats),
        memoryUsageMb: this.modelRegistry.getTotalSize() / 1024,
      });
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.fedLearningCoordinator.on("satellite:registered", (event) => {
      this.logger.info(event, "Satellite registered for federated learning");
    });

    this.fedLearningCoordinator.on("gradient:received", (gradient) => {
      this.logger.info(
        {
          modelId: gradient.modelId,
          epoch: gradient.epoch,
          participantId: gradient.participantId,
        },
        "Gradient received"
      );
    });

    this.fedLearningCoordinator.on("aggregation:complete", (aggregated) => {
      this.logger.info(
        {
          modelId: aggregated.modelId,
          epoch: aggregated.epoch,
          participantCount: aggregated.participantCount,
          method: aggregated.aggregationMethod,
        },
        "Aggregation complete"
      );
    });

    this.fedLearningCoordinator.on("broadcast:update", (event) => {
      this.logger.info(
        {
          modelId: event.update.modelId,
          compressionRatio: event.compressed.metadata.compressionRatio,
        },
        "Update broadcasted"
      );
    });
  }

  /**
   * Record inference for statistics
   */
  private recordInference(
    modelId: string,
    processingTimeMs: number,
    confidence: number
  ): void {
    this.inferenceHistory.push({
      modelId,
      timestamp: Date.now(),
      processingTimeMs,
      confidence,
    });

    // Keep only last 1000 records
    if (this.inferenceHistory.length > 1000) {
      this.inferenceHistory = this.inferenceHistory.slice(-1000);
    }
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
          models: this.modelRegistry.listModels().length,
        },
        "Edge Compute Service started"
      );
    });
  }
}

// Export service
export default EdgeComputeService;

// Start if run directly
if (require.main === module) {
  const service = new EdgeComputeService(3006);
  service.start();
}
