/**
 * Authentication and rate-limiting utilities for the edge hub.
 *
 * MQTT: username/password authenticate via aedes.authenticate hook.
 * REST: Bearer token auth + sliding-window rate limiter.
 */

import crypto from 'node:crypto';

// --- MQTT Authentication ---

export interface MQTTCredentials {
  username: string;
  password: string;
}

/**
 * Validate MQTT client credentials.
 * In production, load from env: PETSENSE_MQTT_USER / PETSENSE_MQTT_PASS.
 * Missing env → reject all connections (fail-closed).
 */
export function validateMQTTAuth(
  username: string | undefined,
  password: string | undefined,
  validCredentials: MQTTCredentials | null,
): boolean {
  if (!validCredentials) return false;
  if (!username || !password) return false;
  const userBuf = Buffer.from(username);
  const passBuf = Buffer.from(password);
  const validUserBuf = Buffer.from(validCredentials.username);
  const validPassBuf = Buffer.from(validCredentials.password);
  if (userBuf.length !== validUserBuf.length || passBuf.length !== validPassBuf.length) return false;
  return (
    crypto.timingSafeEqual(userBuf, validUserBuf) &&
    crypto.timingSafeEqual(passBuf, validPassBuf)
  );
}

export function loadMQTTCredentials(): MQTTCredentials | null {
  const user = process.env.PETSENSE_MQTT_USER;
  const pass = process.env.PETSENSE_MQTT_PASS;
  if (!user || !pass) {
    console.warn('[auth] PETSENSE_MQTT_USER/PETSENSE_MQTT_PASS not set — MQTT auth disabled (dev only)');
    return null;
  }
  return { username: user, password: pass };
}

// --- REST Bearer Token ---

export function validateBearerToken(
  authHeader: string | undefined,
  validToken: string | null,
): boolean {
  if (!validToken) return false;
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const tokenBuf = Buffer.from(token);
  const validBuf = Buffer.from(validToken);
  if (tokenBuf.length !== validBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, validBuf);
}

export function loadBearerToken(): string | null {
  const token = process.env.PETSENSE_API_TOKEN;
  if (!token) {
    console.warn('[auth] PETSENSE_API_TOKEN not set — REST auth disabled (dev only)');
    return null;
  }
  return token;
}

// --- Rate Limiter ---

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private clients: Map<string, RateLimitEntry> = new Map();

  constructor(windowMs = 60_000, maxRequests = 60) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /** Returns true if the request is allowed, false if rate-limited. */
  allow(key: string): boolean {
    const now = Date.now();
    const entry = this.clients.get(key);
    if (!entry || now >= entry.resetAt) {
      this.clients.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.maxRequests) return false;
    entry.count++;
    return true;
  }
}

// --- CORS Allowlist ---

export function isOriginAllowed(origin: string | undefined, allowlist: string[]): boolean {
  if (!origin) return true; // non-browser requests (curl, MQTT clients)
  if (allowlist.length === 0) return false;
  return allowlist.includes(origin);
}
