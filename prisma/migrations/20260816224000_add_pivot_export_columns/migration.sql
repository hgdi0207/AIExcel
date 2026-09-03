ALTER TABLE "pivot_jobs"
ADD COLUMN "export_file_name" VARCHAR(255),
ADD COLUMN "export_file_url" TEXT,
ADD COLUMN "export_file_size_bytes" BIGINT,
ADD COLUMN "export_sheet_name" VARCHAR(255),
ADD COLUMN "export_status" VARCHAR(32) DEFAULT 'pending',
ADD COLUMN "export_error_message" TEXT,
ADD COLUMN "export_started_at" TIMESTAMPTZ(6),
ADD COLUMN "export_completed_at" TIMESTAMPTZ(6);

UPDATE "pivot_jobs"
SET "export_status" = 'pending'
WHERE "export_status" IS NULL;

ALTER TABLE "pivot_jobs"
ALTER COLUMN "export_status" SET DEFAULT 'pending';

CREATE INDEX "pivot_jobs_export_status_idx" ON "pivot_jobs"("export_status");
