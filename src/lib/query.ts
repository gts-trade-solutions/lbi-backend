import { v4 as uuidv4 } from "uuid";
import { pool } from "./mysql";

type Filter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "in"; column: string; values: unknown[] };

type Order = { column: string; ascending?: boolean };

type QueryBody = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  select?: string | null;
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  filters?: Filter[];
  order?: Order[];
  single?: "none" | "single" | "maybeSingle";
  onConflict?: string;
};

const TABLE_COLUMNS: Record<string, Set<string>> = {
  app_users: new Set(["id", "username", "is_active", "created_at"]),
  profiles: new Set(["user_id", "name", "email", "avatar_url", "created_at", "updated_at"]),
  projects: new Set([
    "id",
    "user_id",
    "name",
    "description",
    "created_at",
    "updated_at",
    "last_modified_by",
    "created_by",
  ]),
  routes: new Set(["id", "project_id", "name", "created_at", "updated_at", "user_id"]),
  route_points: new Set([
    "id",
    "route_id",
    "seq",
    "latitude",
    "longitude",
    "elevation",
    "accuracy",
    "timestamp",
    "created_at",
    "user_id",
  ]),
  reports: new Set([
    "id",
    "user_id",
    "project_id",
    "route_id",
    "category",
    "description",
    "created_at",
    "loc_lat",
    "loc_lon",
    "loc_acc",
    "loc_time",
    "voice_url",
    "vehicle_movement",
    "difficulty",
    "sort_order",
    "remarks_action",
    "point_key",
  ]),
  report_photos: new Set([
    "id",
    "report_id",
    "url",
    "width",
    "height",
    "created_at",
    "user_id",
    "file_name",
    "point_key",
    "image_key",
    "has_gps",
    "latitude",
    "longitude",
  ]),
  report_path_points: new Set([
    "id",
    "report_id",
    "seq",
    "latitude",
    "longitude",
    "elevation",
    "accuracy",
    "timestamp",
    "created_at",
    "user_id",
  ]),
  login_events: new Set([
    "id",
    "user_id",
    "lat",
    "lon",
    "accuracy",
    "device_model",
    "os_name",
    "os_version",
    "app_version",
    "created_at",
  ]),
};

const USER_SCOPE_COLUMN: Record<string, string> = {
  app_users: "id",
  profiles: "user_id",
  projects: "user_id",
  routes: "user_id",
  route_points: "user_id",
  reports: "user_id",
  report_photos: "user_id",
  report_path_points: "user_id",
  login_events: "user_id",
};

const UUID_ID_TABLES = new Set([
  "projects",
  "routes",
  "reports",
  "report_photos",
]);

const MYSQL_DATETIME_COLUMNS: Record<string, Set<string>> = {
  reports: new Set(["loc_time"]),
  route_points: new Set(["timestamp"]),
  report_path_points: new Set(["timestamp"]),
};

function qIdent(name: string) {
  return `\`${name.replace(/`/g, "") }\``;
}

function assertTable(table: string) {
  if (!TABLE_COLUMNS[table]) throw new Error("Table is not allowed");
}

function assertColumn(table: string, col: string) {
  if (!TABLE_COLUMNS[table].has(col)) {
    throw new Error(`Column is not allowed: ${col}`);
  }
}

function parseSelectColumns(table: string, select?: string | null) {
  if (!select || select.trim() === "*" || select.trim() === "") {
    return ["*"];
  }

  const cols = select
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ""));

  for (const c of cols) assertColumn(table, c);

  return cols;
}

function normalizeRows(values: QueryBody["values"]) {
  if (!values) return [];
  return Array.isArray(values) ? values : [values];
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function toMysqlDateTimeString(raw: unknown) {
  if (raw == null) return raw;
  if (typeof raw !== "string") return raw;

  const s = raw.trim();
  if (!s) return raw;

  const looksIso =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s) &&
    /(Z|[+-]\d{2}:\d{2})$/.test(s);
  if (!looksIso) return raw;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return raw;

  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate()
  )} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(
    d.getUTCSeconds()
  )}.${pad3(d.getUTCMilliseconds())}`;
}

function normalizeDbValue(table: string, column: string, value: unknown) {
  if (MYSQL_DATETIME_COLUMNS[table]?.has(column)) {
    const normalized = toMysqlDateTimeString(value);
    if (table === "reports" && column === "loc_time" && typeof value === "string") {
      console.log(`[db/query] loc_time incoming=${value}`);
      console.log(`[db/query] loc_time normalized=${String(normalized)}`);
    }
    return normalized;
  }
  return value;
}

function buildWhere(table: string, userId: string, filters: Filter[] = []) {
  const scopeCol = USER_SCOPE_COLUMN[table];
  const whereSql: string[] = [];
  const args: unknown[] = [];

  if (scopeCol) {
    whereSql.push(`${qIdent(scopeCol)} = ?`);
    args.push(userId);
  }

  for (const f of filters) {
    if (f.type === "eq") {
      assertColumn(table, f.column);
      whereSql.push(`${qIdent(f.column)} = ?`);
      args.push(f.value);
      continue;
    }

    if (f.type === "in") {
      assertColumn(table, f.column);
      if (!Array.isArray(f.values) || f.values.length === 0) {
        whereSql.push("1 = 0");
      } else {
        whereSql.push(`${qIdent(f.column)} IN (${f.values.map(() => "?").join(",")})`);
        args.push(...f.values);
      }
    }
  }

  return {
    sql: whereSql.length ? ` WHERE ${whereSql.join(" AND ")}` : "",
    args,
  };
}

async function runSelect(body: QueryBody, userId: string) {
  const table = body.table;
  const cols = parseSelectColumns(table, body.select);
  const where = buildWhere(table, userId, body.filters || []);

  let orderSql = "";
  const order = body.order || [];
  if (order.length) {
    const bits = order.map((o) => {
      assertColumn(table, o.column);
      return `${qIdent(o.column)} ${o.ascending === false ? "DESC" : "ASC"}`;
    });
    orderSql = ` ORDER BY ${bits.join(", ")}`;
  }

  const sql = `SELECT ${cols[0] === "*" ? "*" : cols.map(qIdent).join(", ")} FROM ${qIdent(
    table
  )}${where.sql}${orderSql}`;

  const [rows] = await pool.query(sql, where.args);
  return rows as Record<string, unknown>[];
}

async function runInsert(body: QueryBody, userId: string) {
  const table = body.table;
  const rows = normalizeRows(body.values);
  if (!rows.length) throw new Error("Insert requires values");

  const prepared = rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    const scopeCol = USER_SCOPE_COLUMN[table];
    if (scopeCol && out[scopeCol] == null) {
      out[scopeCol] = userId;
    }
    if (table === "profiles") {
      out.user_id = userId;
    }
    if (UUID_ID_TABLES.has(table) && out.id == null) {
      out.id = uuidv4();
    }
    for (const k of Object.keys(out)) {
      out[k] = normalizeDbValue(table, k, out[k]);
    }
    return out;
  });

  const cols = Object.keys(prepared[0]);
  for (const c of cols) assertColumn(table, c);

  const valuesSql = prepared
    .map(() => `(${cols.map(() => "?").join(",")})`)
    .join(",");

  const args = prepared.flatMap((row) =>
    cols.map((c) => normalizeDbValue(table, c, row[c]))
  );

  const sql = `INSERT INTO ${qIdent(table)} (${cols.map(qIdent).join(",")}) VALUES ${valuesSql}`;
await pool.execute(sql, args as any[]);
  console.log(
    `[db/query] insert table=${table} user=${userId} rowCount=${prepared.length} select=${Boolean(
      body.select
    )} single=${body.single || "none"}`
  );
  const insertedIdCol = table === "profiles" ? "user_id" : "id";
  const insertedIds = prepared
    .map((r) => r[insertedIdCol])
    .filter((v) => v != null)
    .map((v) => String(v));
  console.log(
    `[db/query] insert ids table=${table} idCol=${insertedIdCol} ids=${insertedIds.join(",")}`
  );

  if (body.select) {
    const idCol = table === "profiles" ? "user_id" : "id";
    const ids = prepared
      .map((r) => r[idCol])
      .filter((v) => v != null);

    if (!ids.length) return [];

    const filters: Filter[] = [{ type: "in", column: idCol, values: ids }];
    console.log(
      `[db/query] insert follow-up select table=${table} filter=${idCol} IN (${ids.length})`
    );
    const selected = await runSelect({ ...body, op: "select", filters, order: [] }, userId);
    console.log(
      `[db/query] insert readback table=${table} ids=${ids.length} rowsReturned=${selected.length}`
    );
    return selected;
  }

  return [];
}

async function runUpdate(body: QueryBody, userId: string) {
  const table = body.table;
  const row = Array.isArray(body.values) ? body.values[0] : body.values;
  if (!row || typeof row !== "object") throw new Error("Update requires a values object");

  const normalizedRow: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    normalizedRow[k] = normalizeDbValue(table, k, v);
  }

  const cols = Object.keys(normalizedRow);
  if (!cols.length) return [];

  for (const c of cols) assertColumn(table, c);

  const setSql = cols.map((c) => `${qIdent(c)} = ?`).join(", ");
  const setArgs = cols.map((c) => normalizeDbValue(table, c, normalizedRow[c]));

  const where = buildWhere(table, userId, body.filters || []);
  if (!where.sql) throw new Error("Unsafe update without where");

  const sql = `UPDATE ${qIdent(table)} SET ${setSql}${where.sql}`;
  await pool.execute(sql, [...setArgs, ...where.args] as any[]);
  return [];
}

async function runDelete(body: QueryBody, userId: string) {
  const table = body.table;
  const where = buildWhere(table, userId, body.filters || []);
  if (!where.sql) throw new Error("Unsafe delete without where");

  const sql = `DELETE FROM ${qIdent(table)}${where.sql}`;
 await pool.execute(sql, where.args as any[]);
  return [];
}

async function runUpsert(body: QueryBody, userId: string) {
  const table = body.table;
  const row = Array.isArray(body.values) ? body.values[0] : body.values;
  if (!row || typeof row !== "object") throw new Error("Upsert requires a values object");

  const out: Record<string, unknown> = { ...row };
  const scopeCol = USER_SCOPE_COLUMN[table];
  if (scopeCol && out[scopeCol] == null) {
    out[scopeCol] = userId;
  }
  if (table === "profiles") {
    out.user_id = userId;
  }
  for (const k of Object.keys(out)) {
    out[k] = normalizeDbValue(table, k, out[k]);
  }

  const cols = Object.keys(out);
  for (const c of cols) assertColumn(table, c);

  const onConflict = body.onConflict || "id";
  assertColumn(table, onConflict);

  const insertSql = `INSERT INTO ${qIdent(table)} (${cols.map(qIdent).join(",")}) VALUES (${cols
    .map(() => "?")
    .join(",")})`;

  const updateCols = cols.filter((c) => c !== onConflict);
  const updateSql = updateCols.length
    ? ` ON DUPLICATE KEY UPDATE ${updateCols.map((c) => `${qIdent(c)} = VALUES(${qIdent(c)})`).join(", ")}`
    : "";

 await pool.execute(
  `${insertSql}${updateSql}`,
  cols.map((c) => normalizeDbValue(table, c, out[c])) as any[]
);

  if (body.select) {
    return runSelect(
      {
        ...body,
        op: "select",
        filters: [{ type: "eq", column: onConflict, value: out[onConflict] }],
        order: [],
      },
      userId
    );
  }

  return [];
}

function applySingleMode(rows: Record<string, unknown>[], mode: QueryBody["single"]) {
  const deduped = (() => {
    if (rows.length <= 1) return rows;
    const seen = new Set<string>();
    const out: Record<string, unknown>[] = [];
    for (const row of rows) {
      const id = row?.id ?? row?.user_id ?? null;
      const key =
        id != null
          ? `id:${String(id)}`
          : `json:${JSON.stringify(row, Object.keys(row).sort())}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  })();

  if (mode === "single") {
    if (deduped.length !== 1) {
      console.log(
        `[db/query] single mismatch rows=${rows.length} deduped=${deduped.length}`
      );
      throw new Error(`Expected exactly one row, got ${rows.length}`);
    }
    return deduped[0];
  }

  if (mode === "maybeSingle") {
    if (deduped.length === 0) return null;
    if (deduped.length === 1) return deduped[0];
    console.log(
      `[db/query] maybeSingle mismatch rows=${rows.length} deduped=${deduped.length}`
    );
    throw new Error(`Expected zero or one row, got ${rows.length}`);
  }

  return deduped;
}

export async function executeQuery(body: QueryBody, userId: string) {
  assertTable(body.table);

  let rows: Record<string, unknown>[] = [];

  switch (body.op) {
    case "select":
      rows = await runSelect(body, userId);
      break;
    case "insert":
      rows = await runInsert(body, userId);
      break;
    case "update":
      rows = await runUpdate(body, userId);
      break;
    case "delete":
      rows = await runDelete(body, userId);
      break;
    case "upsert":
      rows = await runUpsert(body, userId);
      break;
    default:
      throw new Error("Unsupported operation");
  }

  return applySingleMode(rows, body.single || "none");
}
