import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const TABLES = [
  "app_auth_users",
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

function parseCopyCounts(sql: string): Map<string, number> {
  const lines = sql.split(/\r?\n/);
  const out = new Map<string, number>();

  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(
      /^COPY\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\((.+)\)\s+FROM\s+stdin;$/
    );
    if (!m) continue;

    const schema = m[1];
    const table = m[2];
    let outTable = "";

    if (schema === "public" && TABLES.includes(table as (typeof TABLES)[number])) {
      outTable = table;
    } else if (schema === "auth" && table === "users") {
      outTable = "app_auth_users";
    } else {
      continue;
    }

    let count = 0;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j] === "\\.") {
        i = j;
        break;
      }
      count += 1;
    }

    out.set(outTable, count);
  }

  return out;
}

async function fetchMysqlCounts(conn: mysql.Connection) {
  const out = new Map<string, number>();
  for (const table of TABLES) {
    const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
    const c = Number((rows as Array<{ c: number }>)[0]?.c || 0);
    out.set(table, c);
  }
  return out;
}

async function main() {
  const backupPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), "..", "..", "backup.sql");

  const sql = await fs.readFile(backupPath, "utf8");
  const pgCounts = parseCopyCounts(sql);

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "tracker",
  });

  try {
    const myCounts = await fetchMysqlCounts(conn);

    let ok = true;
    console.log("Table | backup.sql rows | MySQL rows | Match");
    console.log("----- | --------------- | ---------- | -----");
    for (const table of TABLES) {
      const a = pgCounts.get(table) ?? 0;
      const b = myCounts.get(table) ?? 0;
      const match = a === b;
      if (!match) ok = false;
      console.log(`${table} | ${a} | ${b} | ${match ? "YES" : "NO"}`);
    }

    if (!ok) {
      process.exitCode = 1;
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
