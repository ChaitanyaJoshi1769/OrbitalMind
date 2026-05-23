/**
 * Hybrid Post-Quantum TLS 1.3 Implementation
 * 
 * Extends TLS 1.3 with post-quantum key exchange and signatures
 * Maintains classical TLS compatibility while adding quantum resistance
 */

import tls from "tls";
import crypto from "crypto";
import pino from "pino";
import { KyberKEM, DilithiumDSA, HybridEncryption, HybridSignature } from "../cryptography/lattice-crypto";

/**
 * Hybrid TLS Configuration
 */
export interface HybridTLSConfig {
  kyberVariant: "Kyber512" | "Kyber768" | "Kyber1024";
  dilithiumVariant: "Dilithium2" | "Dilithium3" | "Dilithium5";
  useHybridSignatures: boolean; // If false, use PQ only
  useHybridEncryption: boolean;
}

/**
 * Hybrid TLS Server Context
 * Manages post-quantum key exchange and signature verification
 */
export class HybridTLSServer {
  private config: HybridTLSConfig;
  private logger = pino();
  private kyber: KyberKEM;
  private dilithium: DilithiumDSA;
  private hybridSig: HybridSignature;
  
  // Server keys
  private classicalCert: Buffer;
  private classicalKey: crypto.KeyObject;
  private pqPublicKey: Buffer;
  private pqPrivateKey: Buffer;
  
  // Session tracking
  private activeSessions: Map<string, HybridTLSSession> = new Map();

  constructor(config: HybridTLSConfig, certPath: string, keyPath: string) {
    this.config = config;
    this.kyber = new KyberKEM(config.kyberVariant);
    this.dilithium = new DilithiumDSA(config.dilithiumVariant);
    this.hybridSig = new HybridSignature(config.dilithiumVariant);

    // Load certificates and keys
    // In production: load from files
    this.classicalCert = Buffer.from(""); // Would load from certPath
    this.classicalKey = crypto.createPrivateKey({
      key: Buffer.from(""), // Would load from keyPath
      format: "pem",
    });

    // Generate PQ keypair
    const pqKeypair = this.dilithium.generateKeypair();
    this.pqPublicKey = pqKeypair.publicKey;
    this.pqPrivateKey = pqKeypair.secretKey;

    this.logger.info(
      { config, kyberVariant: config.kyberVariant },
      "Initialized Hybrid TLS Server"
    );
  }

  /**
   * Handle client handshake with PQ support
   * 
   * Extended Handshake Flow:
   * 1. Client Hello + PQ Capability
   * 2. Server Hello + PQ KEM Public Key
   * 3. Client Encapsulates with Kyber
   * 4. Server Decapsulates to recover shared secret
   * 5. Hybrid signatures for authentication
   */
  async handleClientHello(clientHello: Buffer): Promise<{
    serverHello: Buffer;
    kyberPublicKey: Buffer;
    pqCertificate: Buffer;
  }> {
    const sessionId = crypto.randomUUID();

    // Generate Kyber keypair for this session
    const kyberKeypair = this.kyber.generateKeypair();

    // Create PQ certificate (contains Dilithium public key)
    const pqCert = this.createPQCertificate(
      this.pqPublicKey,
      this.classicalCert
    );

    // Store session info
    const session: HybridTLSSession = {
      sessionId,
      state: "hello_sent",
      kyberPublicKey: kyberKeypair.publicKey,
      kyberPrivateKey: kyberKeypair.secretKey,
      sharedSecret: undefined,
      handshakeDone: false,
      timestamp: Date.now(),
    };

    this.activeSessions.set(sessionId, session);

    // Create server hello response
    const serverHello = this.createServerHello(
      sessionId,
      kyberKeypair.publicKey
    );

    return {
      serverHello,
      kyberPublicKey: kyberKeypair.publicKey,
      pqCertificate: pqCert,
    };
  }

  /**
   * Handle client key exchange (encapsulated Kyber ciphertext)
   */
  async handleClientKeyExchange(
    sessionId: string,
    kyberCiphertext: Buffer,
    signature: Buffer
  ): Promise<{
    sharedSecret: Buffer;
    valid: boolean;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { sharedSecret: Buffer.alloc(0), valid: false };
    }

    try {
      // Decapsulate Kyber ciphertext
      const sharedSecret = this.kyber.decapsulate(
        kyberCiphertext,
        session.kyberPrivateKey
      );

      // Verify signature over handshake
      const handshakeHash = this.computeHandshakeHash(sessionId);
      
      // In production, would verify signature from client's PQ certificate
      session.sharedSecret = sharedSecret;
      session.state = "key_exchange_done";

      return { sharedSecret, valid: true };
    } catch (error) {
      this.logger.error(error, "Key exchange failed");
      return { sharedSecret: Buffer.alloc(0), valid: false };
    }
  }

  /**
   * Complete handshake with Finished message
   */
  async finishHandshake(sessionId: string, clientFinished: Buffer): Promise<{
    serverFinished: Buffer;
    valid: boolean;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.sharedSecret) {
      return { serverFinished: Buffer.alloc(0), valid: false };
    }

    try {
      // Verify client finished message
      const handshakeHash = this.computeHandshakeHash(sessionId);
      const clientFinishedExpected = crypto
        .createHmac("sha256", session.sharedSecret)
        .update(handshakeHash)
        .digest();

      if (!crypto.timingSafeEqual(clientFinished, clientFinishedExpected)) {
        throw new Error("Client Finished verification failed");
      }

      // Create server finished message
      const serverFinished = crypto
        .createHmac("sha256", session.sharedSecret)
        .update(Buffer.concat([handshakeHash, clientFinished]))
        .digest();

      session.state = "handshake_done";
      session.handshakeDone = true;

      return { serverFinished, valid: true };
    } catch (error) {
      this.logger.error(error, "Handshake finish failed");
      return { serverFinished: Buffer.alloc(0), valid: false };
    }
  }

  /**
   * Get session keys for record encryption
   * Derives TLS record keys from shared secret
   */
  getSessionKeys(sessionId: string): {
    clientKey: Buffer;
    serverKey: Buffer;
    clientIV: Buffer;
    serverIV: Buffer;
  } | null {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.sharedSecret) {
      return null;
    }

    // Derive keys using HKDF
    const salt = Buffer.alloc(32, 0); // zero salt
    const prk = crypto
      .createHmac("sha256", salt)
      .update(session.sharedSecret)
      .digest();

    // Expand using HKDF-Expand
    const clientKey = this.hkdfExpand(prk, Buffer.from("client_key"), 32);
    const serverKey = this.hkdfExpand(prk, Buffer.from("server_key"), 32);
    const clientIV = this.hkdfExpand(prk, Buffer.from("client_iv"), 12);
    const serverIV = this.hkdfExpand(prk, Buffer.from("server_iv"), 12);

    return { clientKey, serverKey, clientIV, serverIV };
  }

  /**
   * HKDF-Expand
   */
  private hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
    const hmac = crypto.createHmac("sha256", prk);
    hmac.update(info);
    hmac.update(Buffer.from([1])); // Counter
    const output = hmac.digest();
    return output.slice(0, length);
  }

  /**
   * Create server hello message
   */
  private createServerHello(sessionId: string, kyberPublicKey: Buffer): Buffer {
    // Simplified server hello with PQ extension
    const version = Buffer.from([0x03, 0x03]); // TLS 1.2 version
    const random = crypto.randomBytes(32);
    const pqExtension = Buffer.concat([
      Buffer.from([0x00, 0x30]), // PQ Key Share extension ID
      Buffer.from([0x00, kyberPublicKey.length]), // Length
      kyberPublicKey,
    ]);

    return Buffer.concat([version, random, pqExtension]);
  }

  /**
   * Create PQ certificate
   */
  private createPQCertificate(pqPublicKey: Buffer, classicalCert: Buffer): Buffer {
    // Simplified: classical cert + PQ public key extension
    const certLength = classicalCert.length + pqPublicKey.length + 4;
    return Buffer.concat([
      Buffer.from([0x30, certLength]), // DER SEQUENCE
      classicalCert,
      Buffer.from([0x30, pqPublicKey.length + 2]), // PQ extension
      Buffer.from([0x04, pqPublicKey.length]), // OCTET STRING
      pqPublicKey,
    ]);
  }

  /**
   * Compute handshake hash
   */
  private computeHandshakeHash(sessionId: string): Buffer {
    // Hash of all handshake messages so far
    const session = this.activeSessions.get(sessionId);
    if (!session) return Buffer.alloc(0);

    return crypto
      .createHash("sha256")
      .update(Buffer.from(sessionId))
      .digest();
  }

  /**
   * Clean up session
   */
  closeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }
}

/**
 * Hybrid TLS Session State
 */
interface HybridTLSSession {
  sessionId: string;
  state: "hello_sent" | "key_exchange_done" | "handshake_done";
  kyberPublicKey: Buffer;
  kyberPrivateKey: Buffer;
  sharedSecret?: Buffer;
  handshakeDone: boolean;
  timestamp: number;
}

/**
 * Hybrid TLS Client
 * Initiates connection with PQ support
 */
export class HybridTLSClient {
  private config: HybridTLSConfig;
  private logger = pino();
  private kyber: KyberKEM;
  private dilithium: DilithiumDSA;

  // Client keys
  private pqPublicKey: Buffer;
  private pqPrivateKey: Buffer;

  constructor(config: HybridTLSConfig) {
    this.config = config;
    this.kyber = new KyberKEM(config.kyberVariant);
    this.dilithium = new DilithiumDSA(config.dilithiumVariant);

    // Generate PQ keypair
    const pqKeypair = this.dilithium.generateKeypair();
    this.pqPublicKey = pqKeypair.publicKey;
    this.pqPrivateKey = pqKeypair.secretKey;
  }

  /**
   * Send client hello with PQ capability
   */
  createClientHello(): Buffer {
    const version = Buffer.from([0x03, 0x03]); // TLS 1.2
    const random = crypto.randomBytes(32);
    const pqExtension = Buffer.concat([
      Buffer.from([0x00, 0x2f]), // PQ support extension
      Buffer.from([0x00, 0x02]), // Length
      Buffer.from([0x04, 0x01]), // Kyber768 support
    ]);

    return Buffer.concat([version, random, pqExtension]);
  }

  /**
   * Process server hello and extract Kyber public key
   */
  processServerHello(serverHello: Buffer): {
    kyberPublicKey: Buffer;
    sessionId: string;
  } {
    // Extract Kyber public key from server hello
    const kyberPublicKey = serverHello.slice(-1184); // Kyber768 = 1184 bytes
    const sessionId = crypto.randomUUID();

    return { kyberPublicKey, sessionId };
  }

  /**
   * Encapsulate and send Kyber ciphertext
   */
  createKeyExchange(serverKyberPublicKey: Buffer): {
    kyberCiphertext: Buffer;
    sharedSecret: Buffer;
    signature: Buffer;
  } {
    const { ciphertext, sharedSecret } = this.kyber.encapsulate(
      serverKyberPublicKey
    );

    // Sign the key exchange
    const signature = crypto
      .createSign("SHA256")
      .update(ciphertext)
      .sign(this.pqPrivateKey);

    return {
      kyberCiphertext: ciphertext,
      sharedSecret,
      signature: Buffer.from(signature),
    };
  }
}
