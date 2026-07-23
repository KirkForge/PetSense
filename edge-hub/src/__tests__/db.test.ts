import { describe, it, expect, afterEach } from 'vitest';
import { DB, MIGRATIONS } from '../db.js';
import Database from 'better-sqlite3-multiple-ciphers';

describe('DB', () => {
  let db: DB;

  afterEach(() => {
    db?.close();
  });

  it('insert and retrieve positions', () => {
    db = new DB(':memory:');
    db.insertPosition({ pet_id: 'dog-1', x: 5, y: 3, room: 'living', timestamp: 1000 });
    const positions = db.getRecentPositions('dog-1');
    expect(positions.length).toBe(1);
    expect(positions[0].pet_id).toBe('dog-1');
    expect(positions[0].x).toBe(5);
  });

  it('insert and retrieve events', () => {
    db = new DB(':memory:');
    db.insertEvent({ pet_id: 'cat-1', type: 'zone', message: 'entered kitchen', timestamp: 2000 });
    const events = db.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('zone');
  });

  it('upsertZone and getZones', () => {
    db = new DB(':memory:');
    db.upsertZone({ id: 'z1', name: 'Kitchen', bounds: '{"x1":0,"y1":0,"x2":5,"y2":5}', type: 'alert' });
    const zones = db.getZones();
    expect(zones.length).toBe(1);
    expect(zones[0].name).toBe('Kitchen');
  });

  it('deleteZone removes zone', () => {
    db = new DB(':memory:');
    db.upsertZone({ id: 'z1', name: 'Test', bounds: '{}', type: 'info' });
    db.deleteZone('z1');
    expect(db.getZones().length).toBe(0);
  });

  it('getRecentPositions respects limit', () => {
    db = new DB(':memory:');
    for (let i = 0; i < 10; i++) {
      db.insertPosition({ pet_id: 'x', x: i, y: 0, room: 'r', timestamp: i });
    }
    expect(db.getRecentPositions('x', 3).length).toBe(3);
  });

  it('schema_version starts at highest migration version', () => {
    db = new DB(':memory:');
    expect(db.getSchemaVersion()).toBe(MIGRATIONS[MIGRATIONS.length - 1].version);
  });

  it('all v1 tables exist after migration', () => {
    db = new DB(':memory:');
    const raw = db as any;
    const tables = raw.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('positions');
    expect(tableNames).toContain('events');
    expect(tableNames).toContain('zones');
    expect(tableNames).toContain('health_log');
    expect(tableNames).toContain('schema_version');
  });

  it('v3 migration applies and bumps schema_version', () => {
    const testMigrations = [...MIGRATIONS, {
      version: 3,
      sql: 'ALTER TABLE zones ADD COLUMN priority INTEGER DEFAULT 0',
    }];
    const rawDb = new Database(':memory:');
    rawDb.pragma('journal_mode = WAL');
    rawDb.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
    for (const migration of testMigrations) {
      const row = rawDb.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
      const currentVersion = row.v ?? 0;
      if (migration.version <= currentVersion) continue;
      rawDb.transaction(() => {
        rawDb.exec(migration.sql);
        rawDb.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
      })();
    }
    const versionRow = rawDb.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
    expect(versionRow.v).toBe(3);
    const columns = rawDb.pragma('table_info(zones)') as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('priority');
    rawDb.close();
  });

  it('encrypted DB: data readable with key, unreadable without key', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');
    const tmpDir = os.tmpdir();
    const dbPath = path.join(tmpDir, `petsense-test-enc-${Date.now()}.db`);
    const key = 'test-sqlcipher-key';

    try {
      const encrypted = new DB(dbPath, key);
      encrypted.insertPosition({ pet_id: 'dog-1', x: 1, y: 2, room: 'hall', timestamp: 9999 });
      expect(encrypted.getRecentPositions('dog-1').length).toBe(1);
      encrypted.close();

      const reopened = new DB(dbPath, key);
      const positions = reopened.getRecentPositions('dog-1');
      expect(positions.length).toBe(1);
      expect(positions[0].pet_id).toBe('dog-1');
      reopened.close();

      let readFailed = false;
      try {
        const raw = new Database(dbPath);
        raw.prepare('SELECT COUNT(*) as cnt FROM positions').get();
        raw.close();
      } catch {
        readFailed = true;
      }
      expect(readFailed).toBe(true);
    } finally {
      try { fs.unlinkSync(dbPath); } catch {}
      try { fs.unlinkSync(`${dbPath}-wal`); } catch {}
      try { fs.unlinkSync(`${dbPath}-shm`); } catch {}
    }
  });
});