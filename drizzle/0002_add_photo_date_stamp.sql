-- Per-project "print date on photos" setting.
-- Run this once on the production MySQL before deploying the updated backend:
--   npx tsx scripts/apply-mysql-init.ts drizzle/0002_add_photo_date_stamp.sql
-- Adding a defaulted column is safe and non-destructive; existing projects
-- keep the current behaviour (date stamped on every photo).

ALTER TABLE `projects` ADD COLUMN `photo_date_stamp` tinyint(1) NOT NULL DEFAULT 1;
