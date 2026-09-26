import pg from 'pg';
import type { Pool as PgPool, PoolClient } from 'pg';
const Pool = pg.Pool;
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { AsyncLocalStorage } from 'async_hooks';
import * as schema from './schema.ts';
import fs from 'fs';
import path from 'path';

// Transaction context storage to ensure queries between BEGIN and COMMIT/ROLLBACK
// execute on the same checked-out client from the pool
interface TxContext {
  client: PoolClient | null;
}
export const txStorage = new AsyncLocalStorage<TxContext>();

export interface DbConnectionInfo {
  type: 'PostgreSQL Server' | 'PGlite Embedded';
  isStandardPostgres: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  maskedUrl: string;
  connected?: boolean;
  lastError?: string;
}

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();

let isStandardPostgres = false;
let dbInfo: DbConnectionInfo;
let rawPool: PgPool | null = null;
let pgliteClient: PGlite | null = null;
let drizzleInstance: any;
let waitReadyPromise: Promise<void>;

const dataDir = path.resolve(process.cwd(), 'data/postgres_db');

function prepareDataDir() {
  try {
    if (fs.existsSync(dataDir)) {
      const hasPgVersion = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
      const hasConf = fs.existsSync(path.join(dataDir, 'postgresql.conf'));
      const hasGlobal = fs.existsSync(path.join(dataDir, 'global'));
      const hasBase = fs.existsSync(path.join(dataDir, 'base'));

      if (!hasPgVersion || !hasConf || !hasGlobal || !hasBase) {
        console.warn('PostgreSQL data directory is incomplete or corrupted. Recreating clean database cluster...');
        try {
          fs.rmSync(dataDir, { recursive: true, force: true });
        } catch (err) {
          console.error('Error cleaning up dataDir:', err);
        }
      } else {
        const pidFile = path.join(dataDir, 'postmaster.pid');
        if (fs.existsSync(pidFile)) {
          try {
            fs.unlinkSync(pidFile);
          } catch (_) {}
        }
      }
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (fsErr: any) {
    console.warn('Notice: Could not create local data directory:', fsErr.message);
  }
}

async function initPgliteSafely(): Promise<void> {
  isStandardPostgres = false;
  dbInfo = {
    type: 'PGlite Embedded',
    isStandardPostgres: false,
    host: 'localhost',
    port: 0,
    database: dataDir,
    user: 'local',
    ssl: false,
    maskedUrl: `file://${dataDir}`,
    connected: false,
  };

  try {
    prepareDataDir();
    pgliteClient = new PGlite(dataDir);
    await pgliteClient.waitReady;
    await pgliteClient.query('SELECT 1');
    dbInfo.connected = true;
    dbInfo.lastError = undefined;
  } catch (err: any) {
    console.warn('PGlite directory initialization failed, falling back to clean in-memory database:', err?.message);
    try {
      if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true });
      }
    } catch (_) {}
    try {
      pgliteClient = new PGlite();
      await pgliteClient.waitReady;
      await pgliteClient.query('SELECT 1');
      dbInfo.connected = true;
      dbInfo.lastError = undefined;
    } catch (inMemErr: any) {
      console.error('PGlite in-memory fallback failed:', inMemErr);
      dbInfo.connected = false;
      dbInfo.lastError = inMemErr?.message || String(inMemErr);
    }
  }
  if (pgliteClient) {
    drizzleInstance = drizzlePglite(pgliteClient, { schema });
  }
}

if (rawDatabaseUrl && (rawDatabaseUrl.startsWith('postgres://') || rawDatabaseUrl.startsWith('postgresql://'))) {
  // 1. STANDARD POSTGRESQL SERVER MODE (Neon, AWS RDS, Supabase, Local PostgreSQL, etc.)
  isStandardPostgres = true;

  // Mask sensitive credentials for logging and UI display
  let maskedUrl = rawDatabaseUrl;
  let host = 'localhost';
  let port = 5432;
  let database = 'postgres';
  let user = 'postgres';

  try {
    const parsed = new URL(rawDatabaseUrl);
    host = parsed.hostname || 'localhost';
    port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    database = parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'postgres';
    user = parsed.username || 'postgres';
    maskedUrl = `${parsed.protocol}//${user}:****@${host}:${port}/${database}`;
  } catch (_) {
    maskedUrl = 'postgresql://[authenticated]';
  }

  dbInfo = {
    type: 'PostgreSQL Server',
    isStandardPostgres: true,
    host,
    port,
    database,
    user,
    ssl: true,
    maskedUrl,
    connected: false,
  };

  console.log(`🔌 Initializing Standard PostgreSQL Client Pool to ${host}:${port}/${database}...`);

  rawPool = new Pool({
    connectionString: rawDatabaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  rawPool.on('error', (err: any) => {
    const msg = err?.message || String(err);
    // Ignore normal idle client pruning by cloud provider (Neon / AWS / Supabase PgBouncer)
    if (
      msg.includes('Connection terminated unexpectedly') ||
      msg.includes('ECONNRESET') ||
      msg.includes('connection reset') ||
      msg.includes('client has been closed') ||
      err?.code === '57P01'
    ) {
      console.warn(`ℹ️ PostgreSQL pool pruned an idle connection (${msg}). Active connections will reconnect on-demand.`);
      return;
    }
    console.error('Unexpected PostgreSQL Pool Client Error:', err);
    dbInfo.lastError = msg;
  });

  drizzleInstance = drizzlePg(rawPool, { schema });

  waitReadyPromise = rawPool.query('SELECT 1').then(() => {
    console.log(`✅ Connected to Standard PostgreSQL Server (${host}:${port}/${database})`);
    dbInfo.connected = true;
    dbInfo.lastError = undefined;
  }).catch(async (err) => {
    console.warn('⚠️ External PostgreSQL server unreachable, falling back to embedded PGlite database:', err.message);
    await initPgliteSafely();
  });
} else {
  // 2. EMBEDDED POSTGRESQL FALLBACK (When no external DATABASE_URL is provided)
  waitReadyPromise = initPgliteSafely();
}

// Unified client interface that seamlessly routes queries
export const pgClient = {
  waitReady: waitReadyPromise,

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }> {
    if (isStandardPostgres && rawPool) {
      const store = txStorage.getStore();
      const trimmed = text.trim().toUpperCase();

      const isTransientConnectionError = (err: any): boolean => {
        const msg = (err?.message || String(err)).toLowerCase();
        const code = err?.code;
        return (
          msg.includes('connection terminated') ||
          msg.includes('econnreset') ||
          msg.includes('connection reset') ||
          msg.includes('client was closed') ||
          msg.includes('socket hang up') ||
          msg.includes('terminating connection') ||
          msg.includes('closed the connection unexpectedly') ||
          code === '57P01' ||
          code === 'ECONNRESET' ||
          code === 'EPIPE'
        );
      };

      // Transaction management
      if (trimmed === 'BEGIN') {
        if (store) {
          if (!store.client) {
            store.client = await rawPool.connect();
          }
          const res = await store.client.query(text);
          return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
        }
        // If outside store, execute on a client or pool
        const client = await rawPool.connect();
        try {
          const res = await client.query(text);
          return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
        } finally {
          client.release();
        }
      }

      if (trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
        if (store && store.client) {
          const client = store.client;
          store.client = null;
          try {
            const res = await client.query(text);
            client.release();
            const rows = Array.isArray(res) ? (res[res.length - 1]?.rows || []) : (res?.rows || []);
            return { rows: rows as T[], rowCount: res?.rowCount ?? rows.length };
          } catch (txErr: any) {
            try {
              client.release(true); // Discard broken client
            } catch (_) {}
            throw txErr;
          }
        }
        const res = await rawPool.query(text);
        const rows = Array.isArray(res) ? (res[res.length - 1]?.rows || []) : (res?.rows || []);
        return { rows: rows as T[], rowCount: res?.rowCount ?? rows.length };
      }

      // If currently inside an active transaction, use the transaction's dedicated client
      if (store && store.client) {
        try {
          const res = await store.client.query(text, params);
          const rows = Array.isArray(res) ? (res[res.length - 1]?.rows || []) : (res?.rows || []);
          return { rows: rows as T[], rowCount: res?.rowCount ?? rows.length };
        } catch (err: any) {
          if (isTransientConnectionError(err)) {
            try {
              store.client.release(true);
            } catch (_) {}
            store.client = null;
          }
          throw err;
        }
      }

      // Standard query via pool with transparent retry for transient scale-down / wakeup disconnects
      let lastErr: any;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await rawPool.query(text, params);
          const rows = Array.isArray(res) ? (res[res.length - 1]?.rows || []) : (res?.rows || []);
          return { rows: rows as T[], rowCount: res?.rowCount ?? rows.length };
        } catch (err: any) {
          lastErr = err;
          if (attempt === 1 && isTransientConnectionError(err)) {
            console.warn(`⚠️ PostgreSQL connection reset during query (${err?.message || err}). Reconnecting on attempt 2...`);
            await new Promise((resolve) => setTimeout(resolve, 150));
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    }

    if (pgliteClient) {
      try {
        await pgliteClient.waitReady;
        const res = await pgliteClient.query<T>(text, params);
        const rows = res?.rows || [];
        return { rows, rowCount: (res as any)?.affectedRows ?? rows.length };
      } catch (err: any) {
        if (String(err?.message || err).includes('Aborted')) {
          console.warn('PGlite instance aborted, recovering with fresh instance...');
          pgliteClient = new PGlite();
          await pgliteClient.waitReady;
          const res = await pgliteClient.query<T>(text, params);
          const rows = res?.rows || [];
          return { rows, rowCount: (res as any)?.affectedRows ?? rows.length };
        }
        throw err;
      }
    }

    throw new Error('No database client initialized');
  },

  async exec(sql: string): Promise<void> {
    if (isStandardPostgres && rawPool) {
      await rawPool.query(sql);
      return;
    }
    if (pgliteClient) {
      try {
        await pgliteClient.waitReady;
        await pgliteClient.exec(sql);
        return;
      } catch (err: any) {
        if (String(err?.message || err).includes('Aborted')) {
          console.warn('PGlite instance aborted during exec, recovering with fresh instance...');
          pgliteClient = new PGlite();
          await pgliteClient.waitReady;
          await pgliteClient.exec(sql);
          return;
        }
        throw err;
      }
    }
    throw new Error('No database client initialized');
  },
};

export const db = new Proxy({} as any, {
  get: (_, prop) => {
    if (drizzleInstance) {
      return (drizzleInstance as any)[prop];
    }
    return undefined;
  },
});
export { isStandardPostgres, dbInfo, rawPool };

