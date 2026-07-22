import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';

describe('logger', () => {
  it('log output is valid JSON with level, time, msg fields', () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } });
    const logger = pino({ level: 'info' }, sink);
    logger.info('test message');
    const parsed = JSON.parse(lines[lines.length - 1].trim());
    expect(parsed).toHaveProperty('level');
    expect(parsed).toHaveProperty('time');
    expect(parsed).toHaveProperty('msg');
    expect(parsed.msg).toBe('test message');
  });

  it('child logger includes module field', () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } });
    const logger = pino({ level: 'info' }, sink);
    const childLogger = logger.child({ module: 'api' });
    childLogger.info('child message');
    const parsed = JSON.parse(lines[lines.length - 1].trim());
    expect(parsed).toHaveProperty('module');
    expect(parsed.module).toBe('api');
    expect(parsed.msg).toBe('child message');
  });

  it('warn level log has level field set to warn value', () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } });
    const logger = pino({ level: 'debug' }, sink);
    logger.warn('warning message');
    const parsed = JSON.parse(lines[lines.length - 1].trim());
    expect(parsed.level).toBe(40);
  });
});