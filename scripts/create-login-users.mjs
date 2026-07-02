// Create the 5 field-login users (user1..user5) in whatever database this
// server's env points at. Run it ON the server, from the backend-next dir:
//
//   cd backend-next
//   node scripts/create-login-users.mjs
//
// Reads MySQL creds from process.env, falling back to ./.env.local. Idempotent:
// any user whose email already exists is skipped, so re-running is safe.

import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

// --- config: same password for all 5 (change here if you want) ---
const PASSWORD = "Lbi@12345";
const USERS = [1, 2, 3, 4, 5].map((n) => ({
  email: `user${n}@gmail.com`,
  username: `user${n}`,
  name: `User ${n}`,
}));

// --- load DB creds from env, falling back to backend-next/.env.local ---
function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  const out = {};
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}
const fileEnv = loadEnvLocal();
const cfg = {
  host: process.env.MYSQL_HOST || fileEnv.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || fileEnv.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || fileEnv.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || fileEnv.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || fileEnv.MYSQL_DATABASE || "tracker",
};

const conn = await mysql.createConnection(cfg);
console.log(`Connected to ${cfg.host}:${cfg.port}/${cfg.database}\n`);
try {
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const u of USERS) {
    const email = u.email.toLowerCase();
    const [existing] = await conn.query(
      "SELECT id FROM app_auth_users WHERE email = ? LIMIT 1",
      [email]
    );
    if (existing.length) {
      console.log(`SKIP   ${email} (already exists)`);
      continue;
    }
    const id = randomUUID();
    await conn.query(
      "INSERT INTO app_auth_users (id, email, password_hash, full_name, email_confirmed) VALUES (?, ?, ?, ?, 1)",
      [id, email, hash, u.name]
    );
    await conn.query(
      "INSERT INTO app_users (id, username, is_active) VALUES (?, ?, 1)",
      [id, u.username]
    );
    await conn.query(
      "INSERT INTO profiles (user_id, name, email) VALUES (?, ?, ?)",
      [id, u.name, email]
    );
    console.log(`CREATE ${email}  username=${u.username}`);
  }
  console.log(`\nDone. Password for all created users: ${PASSWORD}`);
} finally {
  await conn.end();
}
