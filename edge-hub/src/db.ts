import Database from 'better-sqlite3-multiple-ciphers';
import type { Database as DatabaseType } from 'better-sqlite3-multiple-ciphers';
import { child } from './logger.js';

const log = child('db');

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        room TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_positions_pet_ts ON positions(pet_id, timestamp);
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp);
      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        bounds TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info'
      );
      CREATE TABLE IF NOT EXISTS health_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        check_type TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `SELECT 1;`,
  },
];

export interface PositionRecord {
  pet_id: string;
  x: number;
  y: number;
  room: string;
  timestamp: number;
}

export interface EventRecord {
  pet_id: string;
  type: string;
  message: string;
  timestamp: number;
}

export interface ZoneRecord {
  id: string;
  name: string;
  bounds: string;
  type: string;
}

export class DB {
  private db: DatabaseType;

  constructor(path = ':memory:', encryptionKey?: string) {
    const key = encryptionKey ?? process.env.PETSENSE_DB_KEY;
    this.db = new Database(path);
    if (key) {
      this.db.pragma(`cipher_plaintext_header_size = 32`);
      this.db.pragma(`key = '${key.replace(/'/g, "''")}'`);
      log.info('database encryption enabled');
    }
    this.db.pragma('journal_mode = WAL');
    this.init();
    this.migrate();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);
  }

  private migrate(): void {
    const currentVersion = this.getVersion();
    log.info({ currentVersion, targetVersion: MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0 }, 'running migrations');
    for (const migration of MIGRATIONS) {
      if (migration.version <= currentVersion) continue;
      this.db.transaction(() => {
        this.db.exec(migration.sql);
        this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
      })();
      log.info({ version: migration.version }, 'migration applied');
    }
  }

  private getVersion(): number {
    const row = this.db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
    return row.v ?? 0;
  }

  getSchemaVersion(): number {
    return this.getVersion();
  }

  insertPosition(rec: PositionRecord): void {
    const stmt = this.db.prepare(
      'INSERT INTO positions (pet_id, x, y, room, timestamp) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(rec.pet_id, rec.x, rec.y, rec.room, rec.timestamp);
  }

  getRecentPositions(petId: string, limit = 100): PositionRecord[] {
    const stmt = this.db.prepare(
      'SELECT pet_id, x, y, room, timestamp FROM positions WHERE pet_id = ? ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(petId, limit) as PositionRecord[];
  }

  insertEvent(rec: EventRecord): void {
    const stmt = this.db.prepare(
      'INSERT INTO events (pet_id, type, message, timestamp) VALUES (?, ?, ?, ?)'
    );
    stmt.run(rec.pet_id, rec.type, rec.message, rec.timestamp);
  }

  getEvents(limit = 50): EventRecord[] {
    const stmt = this.db.prepare(
      'SELECT pet_id, type, message, timestamp FROM events ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(limit) as EventRecord[];
  }

  getZones(): ZoneRecord[] {
    const stmt = this.db.prepare('SELECT id, name, bounds, type FROM zones');
    return stmt.all() as ZoneRecord[];
  }

  upsertZone(zone: ZoneRecord): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO zones (id, name, bounds, type) VALUES (?, ?, ?, ?)'
    );
    stmt.run(zone.id, zone.name, zone.bounds, zone.type);
  }

  deleteZone(id: string): void {
    const stmt = this.db.prepare('DELETE FROM zones WHERE id = ?');
    stmt.run(id);
  }

  close(): void {
    this.db.close();
  }
}