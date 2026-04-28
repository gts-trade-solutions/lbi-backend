CREATE TABLE IF NOT EXISTS app_users (
  id varchar(36) NOT NULL,
  username text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY app_users_username_key (username(191))
);

CREATE TABLE IF NOT EXISTS app_auth_users (
  id varchar(36) NOT NULL,
  email varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name text NULL,
  email_confirmed boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY app_auth_users_email_key (email)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id varchar(36) NOT NULL,
  name text NULL,
  email text NULL,
  avatar_url text NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  name text NOT NULL,
  description text NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_modified_by varchar(36) NULL,
  created_by varchar(36) NULL,
  PRIMARY KEY (id),
  KEY ix_projects_user_created (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS bulk_import_history (
  id varchar(36) NOT NULL,
  project_id varchar(36) NOT NULL,
  master_file_name text NULL,
  master_file_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY bulk_import_history_project_hash_uidx (project_id, master_file_hash(191)),
  CONSTRAINT bulk_import_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_modifications (
  id varchar(36) NOT NULL,
  project_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT project_modifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_route_pages (
  id varchar(36) NOT NULL,
  project_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  objective text NOT NULL,
  map_mode varchar(20) NOT NULL DEFAULT 'preset',
  preset_map_key text NULL,
  map_file_url text NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  search_tsv text NULL,
  conclusion_html text NULL,
  PRIMARY KEY (id),
  KEY project_route_pages_project_id_idx (project_id),
  CONSTRAINT project_route_pages_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_route_page_images (
  id varchar(36) NOT NULL,
  project_page_id varchar(36) NOT NULL,
  project_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  file_url text NOT NULL,
  file_name text NULL,
  mime_type text NULL,
  file_size bigint NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY project_route_page_images_page_id_idx (project_page_id),
  KEY project_route_page_images_project_id_idx (project_id),
  CONSTRAINT project_route_page_images_page_fkey FOREIGN KEY (project_page_id) REFERENCES project_route_pages(id) ON DELETE CASCADE,
  CONSTRAINT project_route_page_images_project_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_route_page_locations (
  id varchar(36) NOT NULL,
  project_id varchar(36) NOT NULL,
  project_page_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  label text NOT NULL,
  pin_type text NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY prpl_page_id_idx (project_page_id),
  KEY prpl_project_id_idx (project_id)
);

CREATE TABLE IF NOT EXISTS routes (
  id varchar(36) NOT NULL,
  project_id varchar(36) NOT NULL,
  name text NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_id varchar(36) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_routes_project (project_id),
  CONSTRAINT routes_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS route_points (
  id bigint NOT NULL AUTO_INCREMENT,
  route_id varchar(36) NOT NULL,
  seq int NOT NULL,
  latitude double NOT NULL,
  longitude double NOT NULL,
  elevation double NULL,
  accuracy double NULL,
  timestamp datetime NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id varchar(36) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_route_points_route_seq (route_id, seq),
  CONSTRAINT route_points_route_id_fkey FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  project_id varchar(36) NULL,
  route_id varchar(36) NULL,
  category text NOT NULL,
  description text NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  loc_lat double NULL,
  loc_lon double NULL,
  loc_acc double NULL,
  loc_time datetime NULL,
  voice_url text NULL,
  vehicle_movement varchar(50) NULL,
  difficulty text NULL,
  sort_order int NULL,
  remarks_action text NULL,
  point_key text NULL,
  PRIMARY KEY (id),
  KEY ix_reports_project (project_id),
  KEY ix_reports_user_created (user_id, created_at),
  CONSTRAINT reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT reports_route_id_fkey FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_photos (
  id varchar(36) NOT NULL,
  report_id varchar(36) NOT NULL,
  url text NOT NULL,
  width int NULL,
  height int NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id varchar(36) NOT NULL,
  file_name text NULL,
  point_key text NULL,
  image_key text NULL,
  has_gps boolean NOT NULL DEFAULT true,
  latitude double NULL,
  longitude double NULL,
  PRIMARY KEY (id),
  KEY ix_report_photos_report (report_id),
  KEY ix_report_photos_hasgps (report_id, has_gps),
  CONSTRAINT report_photos_report_id_fkey FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_path_points (
  id bigint NOT NULL AUTO_INCREMENT,
  report_id varchar(36) NOT NULL,
  seq int NOT NULL,
  latitude double NOT NULL,
  longitude double NOT NULL,
  elevation double NULL,
  accuracy double NULL,
  timestamp datetime NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id varchar(36) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_report_path (report_id, seq),
  CONSTRAINT report_path_points_report_id_fkey FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);
