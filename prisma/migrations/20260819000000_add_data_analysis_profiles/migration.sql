-- Add workbook analysis metadata
ALTER TABLE "workbook_sheets"
ADD COLUMN "table_regions_json" JSONB,
ADD COLUMN "field_profiles_json" JSONB,
ADD COLUMN "quality_profile_json" JSONB;

-- Add analysis job result metadata
ALTER TABLE "analysis_jobs"
ADD COLUMN "facts_json" JSONB,
ADD COLUMN "dataset_ref_json" JSONB,
ADD COLUMN "quality_warnings_json" JSONB,
ADD COLUMN "followup_suggestions_json" JSONB,
ADD COLUMN "confidence_score" DECIMAL(5,4);
