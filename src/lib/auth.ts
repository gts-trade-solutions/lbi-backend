import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./mysql";
import { env } from "./env";

export type SessionUser = {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string | null;
  };
};

export type SessionData = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: SessionUser;
};

type TokenPayload = {
  sub: string;
  email: string;
  full_name?: string | null;
};

function requireAuthSecret() {
  if (!env.jwtSecret || env.jwtSecret === "change-me-in-production") {
    throw new Error("AUTH_JWT_SECRET is not configured.");
  }
}

function makeUser(row: {
  id: string;
  email: string;
  full_name: string | null;
}): SessionUser {
  return {
    id: String(row.id),
    email: String(row.email),
    user_metadata: {
      full_name: row.full_name ?? null,
    },
  };
}

export async function signInWithEmailPassword(email: string, password: string) {
  requireAuthSecret();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error("Email and password are required");
  }

  const [rows] = await pool.query(
    `SELECT id, email, password_hash, full_name, email_confirmed
     FROM app_auth_users
     WHERE email = ?
     LIMIT 1`,
    [normalizedEmail]
  );

  const row = (rows as Array<{
    id: string;
    email: string;
    password_hash: string;
    full_name: string | null;
    email_confirmed: number | boolean;
  }>)[0];

  if (!row) {
    throw new Error("Invalid login credentials");
  }

  const ok = await bcrypt.compare(password, String(row.password_hash || ""));
  if (!ok) {
    throw new Error("Invalid login credentials");
  }

  const confirmed = row.email_confirmed === true || Number(row.email_confirmed) === 1;
  if (!confirmed) {
    throw new Error("Email not confirmed");
  }

  const payload: TokenPayload = {
    sub: row.id,
    email: row.email,
    full_name: row.full_name ?? null,
  };

  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresInSec,
  });

  const user = makeUser({
    id: row.id,
    email: row.email,
    full_name: row.full_name ?? null,
  });

  const session: SessionData = {
    access_token: token,
    token_type: "bearer",
    expires_in: env.jwtExpiresInSec,
    user,
  };

  return { session, user };
}

export function parseBearer(header?: string | null) {
  if (!header) return null;
  const [kind, token] = header.split(" ");
  if (!kind || !token) return null;
  if (kind.toLowerCase() !== "bearer") return null;
  return token;
}

export async function verifyToken(token: string): Promise<SessionUser> {
  requireAuthSecret();
  const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
  if (!decoded?.sub || !decoded?.email) {
    throw new Error("Unauthorized");
  }
  return {
    id: decoded.sub,
    email: decoded.email,
    user_metadata: {
      full_name: decoded.full_name ?? null,
    },
  };
}
