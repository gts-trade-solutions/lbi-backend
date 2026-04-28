import {
  bigint,
  boolean,
  datetime,
  double,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

export const appUsers = mysqlTable(
  "app_users",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    username: text("username").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    appUsersUsernameKey: unique("app_users_username_key").on(t.username),
  })
);

export const appAuthUsers = mysqlTable(
  "app_auth_users",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: text("full_name"),
    emailConfirmed: boolean("email_confirmed").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    appAuthUsersEmailKey: unique("app_auth_users_email_key").on(t.email),
  })
);

export const profiles = mysqlTable("profiles", {
  userId: varchar("user_id", { length: 36 }).notNull().primaryKey(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    lastModifiedBy: varchar("last_modified_by", { length: 36 }),
    createdBy: varchar("created_by", { length: 36 }),
  },
  (t) => ({
    projectsUserCreatedIdx: index("ix_projects_user_created").on(t.userId, t.createdAt),
  })
);

export const bulkImportHistory = mysqlTable(
  "bulk_import_history",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    masterFileName: text("master_file_name"),
    masterFileHash: text("master_file_hash").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    bulkImportHistoryProjectHashUidx: unique("bulk_import_history_project_hash_uidx").on(
      t.projectId,
      t.masterFileHash
    ),
  })
);

export const projectModifications = mysqlTable("project_modifications", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectRoutePages = mysqlTable(
  "project_route_pages",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    objective: text("objective").notNull(),
    mapMode: varchar("map_mode", { length: 20 }).notNull().default("preset"),
    presetMapKey: text("preset_map_key"),
    mapFileUrl: text("map_file_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    searchTsv: text("search_tsv"),
    conclusionHtml: text("conclusion_html"),
  },
  (t) => ({
    projectRoutePagesProjectIdIdx: index("project_route_pages_project_id_idx").on(t.projectId),
  })
);

export const projectRoutePageImages = mysqlTable(
  "project_route_page_images",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    projectPageId: varchar("project_page_id", { length: 36 }).notNull(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    fileSize: bigint("file_size", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    projectRoutePageImagesPageIdIdx: index("project_route_page_images_page_id_idx").on(
      t.projectPageId
    ),
    projectRoutePageImagesProjectIdIdx: index("project_route_page_images_project_id_idx").on(
      t.projectId
    ),
  })
);

export const projectRoutePageLocations = mysqlTable(
  "project_route_page_locations",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    projectPageId: varchar("project_page_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    label: text("label").notNull(),
    pinType: text("pin_type"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    prplPageIdIdx: index("prpl_page_id_idx").on(t.projectPageId),
    prplProjectIdIdx: index("prpl_project_id_idx").on(t.projectId),
  })
);

export const routes = mysqlTable(
  "routes",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    userId: varchar("user_id", { length: 36 }).notNull(),
  },
  (t) => ({
    routesProjectIdx: index("ix_routes_project").on(t.projectId),
  })
);

export const routePoints = mysqlTable(
  "route_points",
  {
    id: int("id").autoincrement().notNull().primaryKey(),
    routeId: varchar("route_id", { length: 36 }).notNull(),
    seq: int("seq").notNull(),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    elevation: double("elevation"),
    accuracy: double("accuracy"),
    timestamp: datetime("timestamp", { mode: "string" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    userId: varchar("user_id", { length: 36 }).notNull(),
  },
  (t) => ({
    routePointsRouteSeqIdx: index("ix_route_points_route_seq").on(t.routeId, t.seq),
  })
);

export const reports = mysqlTable(
  "reports",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    projectId: varchar("project_id", { length: 36 }),
    routeId: varchar("route_id", { length: 36 }),
    category: text("category").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    locLat: double("loc_lat"),
    locLon: double("loc_lon"),
    locAcc: double("loc_acc"),
    locTime: datetime("loc_time", { mode: "string" }),
    voiceUrl: text("voice_url"),
    vehicleMovement: varchar("vehicle_movement", { length: 50 }),
    difficulty: text("difficulty"),
    sortOrder: int("sort_order"),
    remarksAction: text("remarks_action"),
    pointKey: text("point_key"),
  },
  (t) => ({
    reportsProjectIdx: index("ix_reports_project").on(t.projectId),
    reportsUserCreatedIdx: index("ix_reports_user_created").on(t.userId, t.createdAt),
  })
);

export const reportPhotos = mysqlTable(
  "report_photos",
  {
    id: varchar("id", { length: 36 }).notNull().primaryKey(),
    reportId: varchar("report_id", { length: 36 }).notNull(),
    url: text("url").notNull(),
    width: int("width"),
    height: int("height"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    fileName: text("file_name"),
    pointKey: text("point_key"),
    imageKey: text("image_key"),
    hasGps: boolean("has_gps").notNull().default(true),
    latitude: double("latitude"),
    longitude: double("longitude"),
  },
  (t) => ({
    reportPhotosReportIdx: index("ix_report_photos_report").on(t.reportId),
    reportPhotosHasGpsIdx: index("ix_report_photos_hasgps").on(t.reportId, t.hasGps),
  })
);

export const reportPathPoints = mysqlTable(
  "report_path_points",
  {
    id: int("id").autoincrement().notNull().primaryKey(),
    reportId: varchar("report_id", { length: 36 }).notNull(),
    seq: int("seq").notNull(),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    elevation: double("elevation"),
    accuracy: double("accuracy"),
    timestamp: datetime("timestamp", { mode: "string" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    userId: varchar("user_id", { length: 36 }).notNull(),
  },
  (t) => ({
    reportPathIdx: index("ix_report_path").on(t.reportId, t.seq),
  })
);
