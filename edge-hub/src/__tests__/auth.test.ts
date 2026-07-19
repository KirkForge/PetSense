import { describe, it, expect } from 'vitest';
import { validateMQTTAuth, validateBearerToken, RateLimiter, isOriginAllowed } from '../auth.js';

describe('validateMQTTAuth', () => {
  const creds = { username: 'hub', password: 'secret123' };

  it('accepts valid credentials', () => {
    expect(validateMQTTAuth('hub', 'secret123', creds)).toBe(true);
  });

  it('rejects wrong password', () => {
    expect(validateMQTTAuth('hub', 'wrong', creds)).toBe(false);
  });

  it('rejects wrong username', () => {
    expect(validateMQTTAuth('admin', 'secret123', creds)).toBe(false);
  });

  it('rejects missing credentials', () => {
    expect(validateMQTTAuth(undefined, undefined, creds)).toBe(false);
  });

  it('rejects when creds is null (no env set)', () => {
    expect(validateMQTTAuth('hub', 'secret123', null)).toBe(false);
  });
});

describe('validateBearerToken', () => {
  it('accepts valid token', () => {
    expect(validateBearerToken('Bearer test-token-123', 'test-token-123')).toBe(true);
  });

  it('rejects wrong token', () => {
    expect(validateBearerToken('Bearer wrong', 'test-token-123')).toBe(false);
  });

  it('rejects missing Authorization header', () => {
    expect(validateBearerToken(undefined, 'test-token-123')).toBe(false);
  });

  it('rejects non-Bearer scheme', () => {
    expect(validateBearerToken('Basic abc123', 'test-token-123')).toBe(false);
  });

  it('rejects when token is null (no env set)', () => {
    expect(validateBearerToken('Bearer test', null)).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('allows requests within limit', () => {
    const limiter = new RateLimiter(60_000, 3);
    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(true);
  });

  it('rejects when limit exceeded', () => {
    const limiter = new RateLimiter(60_000, 2);
    expect(limiter.allow('b')).toBe(true);
    expect(limiter.allow('b')).toBe(true);
    expect(limiter.allow('b')).toBe(false);
  });

  it('different keys are independent', () => {
    const limiter = new RateLimiter(60_000, 1);
    expect(limiter.allow('x')).toBe(true);
    expect(limiter.allow('x')).toBe(false);
    expect(limiter.allow('y')).toBe(true);
  });
});

describe('isOriginAllowed', () => {
  it('allows when allowlist is empty (dev mode)', () => {
    expect(isOriginAllowed('http://localhost:3000', [])).toBe(false);
  });

  it('allows matching origin', () => {
    expect(isOriginAllowed('http://localhost:3000', ['http://localhost:3000'])).toBe(true);
  });

  it('rejects non-matching origin', () => {
    expect(isOriginAllowed('http://evil.com', ['http://localhost:3000'])).toBe(false);
  });

  it('allows undefined origin (non-browser)', () => {
    expect(isOriginAllowed(undefined, ['http://localhost:3000'])).toBe(true);
  });
});
