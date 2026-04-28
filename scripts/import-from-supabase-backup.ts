import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

type CopyBlock = {
  schema: string;
  table: string;
  columns: string[];
  rows: string[][];
};

const IMPORT_TABLES = [
  "app_users",
  "profiles",
  "projects",
  "bulk_import_history",
  "project_modifications",
  "project_route_pages",
  "project_route_page_images",
  "project_route_page_locations",
  "routes",
  "route_points",
  "reports",
  "report_photos",
  "report_path_points",
] as const;

const BOOLEAN_COLUMNS: Record<string, Set<string>> = {
  app_users: new Set(["is_active"]),
  report_photos: new Set(["has_gps"]),
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function normalizePgTimestamp(raw: string): string {
  const v = raw.trim();

  // Matches:
  // 2025-09-27 10:25:24+00
  // 2025-10-07 05:17:20.751974+00
  // 2025-10-07 05:17:20Z
  const m = v.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(?:Z|([+-]\d{2})(?::?(\d{2}))?)$/
  );

  if (!m) return raw;

  const datePart = m[1];
  const timePart = m[2];
  const fracRaw = m[3] || "";
  const offH = m[4];
  const offM = m[5];

  // Fast path for UTC suffix: preserve wall-clock, strip TZ, keep up to 6 fractional digits.
  if (!offH || (offH === "+00" && (!offM || offM === "00"))) {
    const frac = fracRaw ? `.${fracRaw.slice(0, 6).padEnd(Math.min(fracRaw.length, 6), "0")}` : "";
    return `${datePart} ${timePart}${frac}`;
  }

  // Non-UTC offset: convert instant to UTC and serialize as MySQL DATETIME text.
  const iso = `${datePart}T${timePart}${fracRaw ? `.${fracRaw}` : ""}${offH}:${offM || "00"}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const frac = fracRaw ? `.${fracRaw.slice(0, 6)}` : "";
    return `${datePart} ${timePart}${frac}`;
  }

  const outDate = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const outTime = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;

  // JS Date keeps millisecond precision, still MySQL-safe and closest available here.
  const ms = d.getUTCMilliseconds();
  const frac = ms ? `.${pad3(ms)}` : "";
  return `${outDate} ${outTime}${frac}`;
}

function splitPgCopyLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\t") {
      out.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\\") {
      const next = line[i + 1];
      if (next === "N") {
        cur += "\\N";
        i += 1;
        continue;
      }
      if (next === "t") {
        cur += "\t";
        i += 1;
        continue;
      }
      if (next === "n") {
        cur += "\n";
        i += 1;
        continue;
      }
      if (next === "r") {
        cur += "\r";
        i += 1;
        continue;
      }
      if (next === "\\") {
        cur += "\\";
        i += 1;
        continue;
      }
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function parseCopyBlocks(sql: string): Map<string, CopyBlock> {
  const lines = sql.split(/\r?\n/);
  const blocks = new Map<string, CopyBlock>();

  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(
      /^COPY\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\s*\((.+)\)\s+FROM\s+stdin;$/
    );
    if (!m) continue;

    const fullTable = m[1];
    const [schema, table] = fullTable.split(".");
    const columns = m[2].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));

    const rows: string[][] = [];

    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j] === "\\.") {
        i = j;
        break;
      }
      rows.push(splitPgCopyLine(lines[j]));
    }

    blocks.set(`${schema}.${table}`, { schema, table, columns, rows });
  }

  return blocks;
}

function convertValue(table: string, column: string, raw: string): unknown {
  if (raw === "\\N") return null;

  const normalizedTs = normalizePgTimestamp(raw);
  if (normalizedTs !== raw) return normalizedTs;

  if (BOOLEAN_COLUMNS[table]?.has(column)) {
    if (raw === "t") return 1;
    if (raw === "f") return 0;
  }

  return raw;
}

async function getMysqlTableColumns(conn: mysql.Connection, table: string) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS column_name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );

  const cols = new Set<string>();
  for (const r of rows as Array<{ column_name: string }>) {
    cols.add(r.column_name);
  }
  return cols;
}

async function importBlock(
  conn: mysql.Connection,
  block: CopyBlock,
  mysqlCols: Set<string>
) {
  if (!block.rows.length) return;

  const keep = block.columns
    .map((c, idx) => ({ c, idx }))
    .filter((x) => mysqlCols.has(x.c));

  if (!keep.length) {
    console.log(`Skipped ${block.table}: no matching columns in target table`);
    return;
  }

  const skipped = block.columns.filter((c) => !mysqlCols.has(c));
  if (skipped.length) {
    console.log(`Skipping columns for ${block.table}: ${skipped.join(", ")}`);
  }

  const cols = keep.map((x) => x.c);
  const placeholders = `(${keep.map(() => "?").join(",")})`;
  const sqlBase = `INSERT INTO \`${block.table}\` (${cols
    .map((c) => `\`${c}\``)
    .join(",")}) VALUES ${block.rows.map(() => placeholders).join(",")}`;

  const args = block.rows.flatMap((row) =>
    keep.map(({ c, idx }) => convertValue(block.table, c, row[idx]))
  );

  const updateSql = cols.length
    ? ` ON DUPLICATE KEY UPDATE ${cols
        .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
        .join(", ")}`
    : "";

  await conn.query(`${sqlBase}${updateSql}`, args);
}

async function importAuthUsers(conn: mysql.Connection, block: CopyBlock) {
  if (!block.rows.length) return;

  const idxId = block.columns.indexOf("id");
  const idxEmail = block.columns.indexOf("email");
  const idxHash = block.columns.indexOf("encrypted_password");
  const idxMeta = block.columns.indexOf("raw_user_meta_data");
  const idxConfirmed = block.columns.indexOf("email_confirmed_at");
  const idxCreatedAt = block.columns.indexOf("created_at");

  if (idxId < 0 || idxEmail < 0 || idxHash < 0) return;

  for (const row of block.rows) {
    const id = convertValue("users", "id", row[idxId]) as string | null;
    const email = convertValue("users", "email", row[idxEmail]) as string | null;
    const passwordHash = convertValue("users", "encrypted_password", row[idxHash]) as string | null;
    const confirmedRaw = convertValue("users", "email_confirmed_at", row[idxConfirmed] || "\\N");
    const createdAt = convertValue("users", "created_at", row[idxCreatedAt] || "\\N");

    if (!id || !email || !passwordHash) continue;

    const metaRaw = convertValue("users", "raw_user_meta_data", row[idxMeta] || "\\N");
    let fullName: string | null = null;
    if (typeof metaRaw === "string" && metaRaw) {
      try {
        const meta = JSON.parse(metaRaw);
        fullName = meta?.full_name ?? null;
      } catch {}
    }

    const emailConfirmed = confirmedRaw != null ? 1 : 0;

    await conn.query(
      `INSERT INTO app_auth_users (id, email, password_hash, full_name, email_confirmed, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         password_hash = VALUES(password_hash),
         full_name = VALUES(full_name),
         email_confirmed = VALUES(email_confirmed),
         created_at = VALUES(created_at)`,
      [id, String(email).toLowerCase(), passwordHash, fullName, emailConfirmed, createdAt]
    );
  }

  console.log(`Imported app_auth_users from auth.users: ${block.rows.length} rows`);
}

async function main() {
  const backupPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), "..", "..", "backup.sql");

  const sql = await fs.readFile(backupPath, "utf8");
  const blocks = parseCopyBlocks(sql);

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "tracker",
    multipleStatements: true,
  });

  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of IMPORT_TABLES) {
      const block = blocks.get(`public.${table}`);
      if (!block) continue;
      const mysqlCols = await getMysqlTableColumns(conn, table);
      if (!mysqlCols.size) {
        throw new Error(`Target MySQL table not found or has no columns: ${table}`);
      }

      await importBlock(conn, block, mysqlCols);
      console.log(`Imported ${table}: ${block.rows.length} rows`);
    }

    const authUsers = blocks.get("auth.users");
    if (authUsers) {
      await importAuthUsers(conn, authUsers);
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
