import { createClient } from '@libsql/client';
import path from 'path';

// Determine URL and Auth Token (works for Turso in production or local db.sqlite file in development)
const dbUrl = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), 'db.sqlite')}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const client = createClient({
  url: dbUrl,
  authToken: authToken,
});

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initDb() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await client.executeMultiple(`
          CREATE TABLE IF NOT EXISTS mandates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'Default Mandate',
            max_amount REAL NOT NULL,
            allowed_categories TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL,
            limit_price REAL NOT NULL DEFAULT 0,
            category TEXT NOT NULL,
            image_url TEXT,
            reference_link TEXT
          );

          CREATE TABLE IF NOT EXISTS agent_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mandate_id INTEGER,
            mandate_name TEXT,
            action_type TEXT CHECK(action_type IN ('purchase_attempt', 'purchase_approved', 'purchase_declined', 'payment_failed', 'retry_attempt', 'recovery_abandoned', 'system_error')),
            reasoning TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            razorpay_order_id TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(mandate_id) REFERENCES mandates(id)
          );
        `);

        // Idempotent column additions for existing databases
        const alterCols = [
          "ALTER TABLE products ADD COLUMN image_url TEXT;",
          "ALTER TABLE products ADD COLUMN reference_link TEXT;",
          "ALTER TABLE products ADD COLUMN limit_price REAL DEFAULT 0;",
          "ALTER TABLE mandates ADD COLUMN name TEXT DEFAULT 'Default Mandate';",
          "ALTER TABLE agent_actions ADD COLUMN mandate_name TEXT;",
          "ALTER TABLE agent_actions ADD COLUMN transaction_group_id TEXT;"
        ];

        for (const stmt of alterCols) {
          try {
            await client.execute(stmt);
          } catch {
            // Ignore if column already exists
          }
        }

        // Backfill transaction_group_id for existing paired records
        try {
          const attRes = await client.execute("SELECT * FROM agent_actions WHERE action_type = 'purchase_attempt' AND (transaction_group_id IS NULL OR transaction_group_id = '')");
          const unmappedAttempts: any[] = attRes.rows;
          
          const resRes = await client.execute("SELECT * FROM agent_actions WHERE action_type != 'purchase_attempt' AND (transaction_group_id IS NULL OR transaction_group_id = '')");
          const unmappedResolutions: any[] = resRes.rows;

          for (const att of unmappedAttempts) {
            const match = unmappedResolutions.find((res: any) => {
              if (att.razorpay_order_id && res.razorpay_order_id && att.razorpay_order_id === res.razorpay_order_id) return true;
              const amtMatch = Math.abs(Number(att.amount) - Number(res.amount)) < 0.01;
              const mandateMatch = att.mandate_id === res.mandate_id || (!att.mandate_id && !res.mandate_id);
              const tDiff = Math.abs(new Date(res.timestamp as string).getTime() - new Date(att.timestamp as string).getTime());
              return amtMatch && mandateMatch && tDiff <= 120000;
            });

            if (match) {
              const grpId = att.razorpay_order_id || match.razorpay_order_id || `tx_grp_pair_${att.id}_${match.id}`;
              await client.execute({
                sql: "UPDATE agent_actions SET transaction_group_id = ? WHERE id = ? OR id = ?",
                args: [grpId, att.id, match.id]
              });
            }
          }
        } catch (e) {
          console.error('Error backfilling transaction_group_id:', e);
        }

        // Ensure purchase_attempt records are never marked as success in DB
        try {
          await client.execute("UPDATE agent_actions SET status = 'completed' WHERE action_type = 'purchase_attempt' AND status = 'success'");
        } catch {}

        initialized = true;
      } catch (err) {

        console.error('Database initialization error:', err);
      }
    })();
  }
  return initPromise;
}

export const db = {
  async all<T = any>(sql: string, args: any[] = []): Promise<T[]> {
    await initDb();
    const res = await client.execute({ sql, args });
    return res.rows as unknown as T[];
  },
  async get<T = any>(sql: string, args: any[] = []): Promise<T | undefined> {
    await initDb();
    const res = await client.execute({ sql, args });
    return (res.rows[0] as unknown as T) || undefined;
  },
  async run(sql: string, args: any[] = []): Promise<{ lastInsertRowid: number | bigint; rowsAffected: number }> {
    await initDb();
    const res = await client.execute({ sql, args });
    return {
      lastInsertRowid: Number(res.lastInsertRowid ?? 0),
      rowsAffected: res.rowsAffected,
    };
  },
  async exec(sql: string): Promise<void> {
    await initDb();
    await client.executeMultiple(sql);
  }
};

export interface Mandate {
  id: number;
  name?: string;
  max_amount: number;
  allowed_categories: string; // JSON string of string[]
  expires_at: string;
  created_at?: string;
}

export interface Product {
  id: number;
  name: string;
  limit_price: number;
  category: string;
  price?: number;
  image_url?: string | null;
  reference_link?: string | null;
}

export interface AgentAction {
  id: number;
  mandate_id: number | null;
  mandate_name?: string | null;
  action_type: 'purchase_attempt' | 'purchase_approved' | 'purchase_declined' | 'payment_failed' | 'retry_attempt' | 'recovery_abandoned' | 'system_error';
  reasoning: string;
  amount: number;
  status: string;
  razorpay_order_id: string | null;
  transaction_group_id?: string | null;
  timestamp?: string;
}

export default db;
