import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

async function main() {
  const sqlPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), "scripts", "mysql-init.sql");

  const sql = await fs.readFile(sqlPath, "utf8");

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "tracker",
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    console.log(`Schema applied successfully from: ${sqlPath}`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
