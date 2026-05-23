/**
 * Quantum-Safe Communications Service
 * 
 * Provides post-quantum cryptography infrastructure for OrbitalMind
 * Implements hybrid PQ schemes alongside classical cryptography
 */

import express, { Express, Request, Response } from "express";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import pino from "pino";
import crypto from "crypto";
import {
  KyberKEM,
  DilithiumDSA,
  HybridEncryption,
  HybridSignature,
} from "./cryptography/lattice-crypto";
import {
  HybridTLSServer,
  HybridTLSClient,
} from "./tls/hybrid-tls";

interface KeyStoreEntry {
  keyId: string;
  type: "kyber512" | "kyber768" | "kyber1024" | "dilithium2" | "dilithium3" | "dilithium5";
  publicKey: Buffer;
  secretKey?: Buffer; // Only for private keys
  createdAt: number;
  expiresAt: number;
}

interface CryptoSession {
  sessionId: string;
  algorithm: "hybrid" | "kyber_only" | "dilithium_only";
  status: "active" | "completed" | "expired";
  createdAt: number;
  expiresAt: number;
}

class QuantumCommsService {
  private app: Express;
  private server: http.Server;
  private logger = pino();
  private keyStore: Map<string, KeyStoreEntry> = new Map();
  private cryptoSessions: Map<string, CryptoSession> = new Map();
  
  private kyber768: KyberKEM = new KyberKEM("Kyber768");
  private dilithium3: DilithiumDSA = new DilithiumDSA("Dilithium3");
  private hybridEnc: HybridEncryption = new HybridEncryption("Kyber768");
  private hybridSig: HybridSignature = new HybridSignature("Dilithium3");

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      const requestId = uuidv4();
      res.setHeader("X-Request-ID", requestId);
      (req as any).id = requestId;
      next();
    });
  }

  private setupRoutes(): void {
    // Key generation and management
    this.app.post("/api/v1/crypto/keys/generate", this.handleGenerateKey.bind(this));
    this.app.get("/api/v1/crypto/keys/:keyId", this.handleGetKey.bind(this));
    this.app.post("/api/v1/crypto/keys/:keyId/delete", this.handleDeleteKey.bind(this));
    this.app.get("/api/v1/crypto/keys", this.handleListKeys.bind(this));

    // Hybrid encryption
    this.app.post("/api/v1/crypto/encrypt", this.handleEncrypt.bind(this));
    this.app.post("/api/v1/crypto/decrypt", this.handleDecrypt.bind(this));

    // Hybrid signatures
    this.app.post("/api/v1/crypto/sign", this.handleSign.bind(this));
    this.app.post("/api/v1/crypto/verify", this.handleVerify.bind(this));

    // Kyber KEM operations
    this.app.post("/api/v1/crypto/kem/encapsulate", this.handleKemEncapsulate.bind(this));
    this.app.post("/api/v1/crypto/kem/decapsulate", this.handleKemDecapsulate.bind(this));

    // Dilithium operations
    this.app.post("/api/v1/crypto/dsa/sign", this.handleDSASign.bind(this));
    this.app.post("/api/v1/crypto/dsa/verify", this.handleDSAVerify.bind(this));

    // TLS session management
    this.app.post("/api/v1/crypto/tls/session", this.handleTLSSession.bind(this));
    this.app.get("/api/v1/crypto/tls/session/:sessionId", this.handleGetTLSSession.bind(this));

    // Algorithm info
    this.app.get("/api/v1/crypto/algorithms", this.handleGetAlgorithms.bind(this));
    this.app.get("/api/v1/crypto/status", this.handleStatus.bind(this));

    // Health check
    this.app.get("/api/v1/health", this.handleHealthCheck.bind(this));
  }

  private async handleGenerateKey(req: Request, res: Response): Promise<void> {
    const { algorithm, privateKey = false } = req.body;

    try {
      let keypair: { publicKey: Buffer; secretKey: Buffer };
      let keyType: KeyStoreEntry["type"];

      switch (algorithm) {
        case "kyber768":
          keypair = new KyberKEM("Kyber768").generateKeypair();
          keyType = "kyber768";
          break;
        case "dilithium3":
          keypair = new DilithiumDSA("Dilithium3").generateKeypair();
          keyType = "dilithium3";
          break;
        default:
          res.status(400).json({ error: "Unsupported algorithm" });
          return;
      }

      const keyId = uuidv4();
      const entry: KeyStoreEntry = {
        keyId,
        type: keyType,
        publicKey: keypair.publicKey,
        secretKey: privateKey ? keypair.secretKey : undefined,
        createdAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      };

      this.keyStore.set(keyId, entry);

      res.status(201).json({
        keyId,
        algorithm,
        publicKey: keypair.publicKey.toString("base64"),
        secretKey: privateKey ? keypair.secretKey.toString("base64") : undefined,
      });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Key generation failed" });
    }
  }

  private async handleGetKey(req: Request, res: Response): Promise<void> {
    const { keyId } = req.params;
    const entry = this.keyStore.get(keyId);

    if (!entry) {
      res.status(404).json({ error: "Key not found" });
      return;
    }

    res.status(200).json({
      keyId: entry.keyId,
      type: entry.type,
      publicKey: entry.publicKey.toString("base64"),
      hasPrivateKey: !!entry.secretKey,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
    });
  }

  private async handleDeleteKey(req: Request, res: Response): Promise<void> {
    const { keyId } = req.params;
    const deleted = this.keyStore.delete(keyId);

    res.status(deleted ? 200 : 404).json({
      status: deleted ? "deleted" : "not_found",
    });
  }

  private async handleListKeys(req: Request, res: Response): Promise<void> {
    const keys = Array.from(this.keyStore.values()).map((entry) => ({
      keyId: entry.keyId,
      type: entry.type,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
    }));

    res.status(200).json({ keys });
  }

  private async handleEncrypt(req: Request, res: Response): Promise<void> {
    const { plaintext, publicKeyId } = req.body;
    const entry = this.keyStore.get(publicKeyId);

    if (!entry) {
      res.status(404).json({ error: "Public key not found" });
      return;
    }

    try {
      const pt = Buffer.from(plaintext, "base64");
      const { kyberCiphertext, aesCiphertext, iv, tag } = this.hybridEnc.encrypt(
        pt,
        entry.publicKey
      );

      res.status(200).json({
        kyberCiphertext: kyberCiphertext.toString("base64"),
        aesCiphertext: aesCiphertext.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
      });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Encryption failed" });
    }
  }

  private async handleDecrypt(req: Request, res: Response): Promise<void> {
    const { kyberCiphertext, aesCiphertext, iv, tag, secretKeyId } = req.body;
    const entry = this.keyStore.get(secretKeyId);

    if (!entry || !entry.secretKey) {
      res.status(404).json({ error: "Secret key not found" });
      return;
    }

    try {
      const plaintext = this.hybridEnc.decrypt(
        Buffer.from(kyberCiphertext, "base64"),
        Buffer.from(aesCiphertext, "base64"),
        Buffer.from(iv, "base64"),
        Buffer.from(tag, "base64"),
        entry.secretKey
      );

      res.status(200).json({
        plaintext: plaintext.toString("base64"),
      });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Decryption failed" });
    }
  }

  private async handleSign(req: Request, res: Response): Promise<void> {
    const { message, secretKeyId } = req.body;
    const entry = this.keyStore.get(secretKeyId);

    if (!entry || !entry.secretKey) {
      res.status(404).json({ error: "Secret key not found" });
      return;
    }

    try {
      const msg = Buffer.from(message, "base64");
      const classicalKey = crypto.generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
      });

      const { classicalSignature, pqSignature } = this.hybridSig.sign(
        msg,
        classicalKey.privateKey,
        entry.secretKey
      );

      res.status(200).json({
        classicalSignature: classicalSignature.toString("base64"),
        pqSignature: pqSignature.toString("base64"),
      });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Signing failed" });
    }
  }

  private async handleVerify(req: Request, res: Response): Promise<void> {
    const { message, classicalSignature, pqSignature, publicKeyId } = req.body;
    const entry = this.keyStore.get(publicKeyId);

    if (!entry) {
      res.status(404).json({ error: "Public key not found" });
      return;
    }

    try {
      const msg = Buffer.from(message, "base64");
      const classicalKey = crypto.createPublicKey({
        key: Buffer.from(""), // In production: load from entry
        format: "pem",
      });

      const valid = this.hybridSig.verify(
        msg,
        Buffer.from(pqSignature, "base64"),
        Buffer.from(pqSignature, "base64"),
        classicalKey,
        entry.publicKey
      );

      res.status(200).json({ valid });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Verification failed" });
    }
  }

  private async handleKemEncapsulate(req: Request, res: Response): Promise<void> {
    const { publicKeyId } = req.body;
    const entry = this.keyStore.get(publicKeyId);

    if (!entry) {
      res.status(404).json({ error: "Public key not found" });
      return;
    }

    try {
      const { ciphertext, sharedSecret } = this.kyber768.encapsulate(entry.publicKey);

      res.status(200).json({
        ciphertext: ciphertext.toString("base64"),
        sharedSecret: sharedSecret.toString("base64"),
      });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Encapsulation failed" });
    }
  }

  private async handleKemDecapsulate(req: Request, res: Response): Promise<void> {
    const { ciphertext, secretKeyId } = req.body;
    const entry = this.keyStore.get(secretKeyId);

    if (!entry || !entry.secretKey) {
      res.status(404).json({ error: "Secret key not found" });
      return;
    }

    try {
      const sharedSecret = this.kyber768.decapsulate(
        Buffer.from(ciphertext, "base64"),
        entry.secretKey
      );

      res.status(200).json({
        sharedSecret: sharedSecret.toString("base64"),
      });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Decapsulation failed" });
    }
  }

  private async handleDSASign(req: Request, res: Response): Promise<void> {
    const { message, secretKeyId } = req.body;
    const entry = this.keyStore.get(secretKeyId);

    if (!entry || !entry.secretKey) {
      res.status(404).json({ error: "Secret key not found" });
      return;
    }

    try {
      const msg = Buffer.from(message, "base64");
      const signature = this.dilithium3.sign(msg, entry.secretKey);

      res.status(200).json({
        signature: signature.toString("base64"),
      });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Signing failed" });
    }
  }

  private async handleDSAVerify(req: Request, res: Response): Promise<void> {
    const { message, signature, publicKeyId } = req.body;
    const entry = this.keyStore.get(publicKeyId);

    if (!entry) {
      res.status(404).json({ error: "Public key not found" });
      return;
    }

    try {
      const msg = Buffer.from(message, "base64");
      const valid = this.dilithium3.verify(
        msg,
        Buffer.from(signature, "base64"),
        entry.publicKey
      );

      res.status(200).json({ valid });
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: "Verification failed" });
    }
  }

  private async handleTLSSession(req: Request, res: Response): Promise<void> {
    const sessionId = uuidv4();
    const session: CryptoSession = {
      sessionId,
      algorithm: "hybrid",
      status: "active",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
    };

    this.cryptoSessions.set(sessionId, session);

    res.status(201).json({ sessionId, algorithm: "hybrid" });
  }

  private async handleGetTLSSession(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const session = this.cryptoSessions.get(sessionId);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.status(200).json(session);
  }

  private async handleGetAlgorithms(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      kem: [
        {
          name: "Kyber512",
          securityLevel: "128-bit",
          publicKeySize: 800,
          ciphertextSize: 768,
        },
        {
          name: "Kyber768",
          securityLevel: "192-bit",
          publicKeySize: 1184,
          ciphertextSize: 1088,
        },
        {
          name: "Kyber1024",
          securityLevel: "256-bit",
          publicKeySize: 1568,
          ciphertextSize: 1568,
        },
      ],
      dsa: [
        {
          name: "Dilithium2",
          securityLevel: "128-bit",
          publicKeySize: 1312,
          signatureSize: 2420,
        },
        {
          name: "Dilithium3",
          securityLevel: "192-bit",
          publicKeySize: 1952,
          signatureSize: 3293,
        },
        {
          name: "Dilithium5",
          securityLevel: "256-bit",
          publicKeySize: 2592,
          signatureSize: 4595,
        },
      ],
      encryption: ["hybrid_kyber_aes256"],
      signatures: ["hybrid_dilithium_ecdsa"],
    });
  }

  private async handleStatus(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "healthy",
      service: "quantum-comms",
      uptime: process.uptime(),
      keys: this.keyStore.size,
      sessions: this.cryptoSessions.size,
      algorithms: {
        kem: "Kyber (NIST PQC)",
        dsa: "Dilithium (NIST PQC)",
        hybrid: "Kyber + AES-256-GCM + Dilithium + ECDSA",
      },
    });
  }

  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "healthy",
      service: "quantum-comms",
      uptime: process.uptime(),
      memoryUsage: {
        heapUsed: process.memoryUsage().heapUsed / 1024 / 1024,
        heapTotal: process.memoryUsage().heapTotal / 1024 / 1024,
      },
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: any, req: Request, res: Response) => {
      this.logger.error(err);
      res.status(500).json({ error: "Internal server error" });
    });
  }

  async start(port: number = 3004): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(port, () => {
          this.logger.info(`Quantum Comms service listening on port ${port}`);
          resolve();
        });
      } catch (error) {
        this.logger.error(error);
        reject(error);
      }
    });
  }

  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info("Quantum Comms service shut down gracefully");
        resolve();
      });
    });
  }
}

const service = new QuantumCommsService();
service.start(3004).catch((error) => {
  console.error("Failed to start Quantum Comms service:", error);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received");
  await service.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received");
  await service.shutdown();
  process.exit(0);
});

export { QuantumCommsService };
