import { drizzle } from "drizzle-orm/mysql2";
import { pool } from "./mysql";

export const db = drizzle(pool);
