-- Recycle bin: soft-delete support.
-- Run this once on the production MySQL before deploying the updated backend.
-- Adding a nullable column is safe and non-destructive.

ALTER TABLE `reports`  ADD COLUMN `deleted_at` datetime NULL;
ALTER TABLE `projects` ADD COLUMN `deleted_at` datetime NULL;

-- Helps the "list bin" / "purge expired" queries.
CREATE INDEX `ix_reports_deleted_at`  ON `reports`  (`deleted_at`);
CREATE INDEX `ix_projects_deleted_at` ON `projects` (`deleted_at`);
