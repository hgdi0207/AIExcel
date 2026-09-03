-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('free', 'pro', 'pro_plus', 'team', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'microsoft');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid');

-- CreateEnum
CREATE TYPE "WorkbookStatus" AS ENUM ('uploaded', 'parsing', 'ready', 'failed', 'archived');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "AssistantRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "ToolType" AS ENUM ('assistant', 'pivot_builder', 'data_analysis', 'charts', 'reports', 'file_upload');

-- CreateEnum
CREATE TYPE "UsageMetricType" AS ENUM ('spreadsheet_assistant', 'pivot_builder', 'data_analysis', 'charts', 'reports', 'file_upload', 'credit_total', 'sol_usage');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('month', 'rolling_12h');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('consume', 'refund');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('md', 'docx', 'pdf');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120),
    "avatar_url" TEXT,
    "plan" "UserPlan" NOT NULL DEFAULT 'free',
    "locale" VARCHAR(16) DEFAULT 'en',
    "timezone" VARCHAR(64) DEFAULT 'Asia/Shanghai',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "provider_email" VARCHAR(255),
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'stripe',
    "provider_customer_id" VARCHAR(255),
    "provider_subscription_id" VARCHAR(255),
    "plan_code" VARCHAR(64) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'usd',
    "amount_cents" INTEGER NOT NULL,
    "interval" VARCHAR(16) NOT NULL,
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'stripe',
    "provider_event_id" VARCHAR(255) NOT NULL,
    "provider_subscription_id" VARCHAR(255),
    "event_type" VARCHAR(128) NOT NULL,
    "payload_json" JSONB,
    "status" VARCHAR(32) NOT NULL DEFAULT 'processed',
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workbooks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(16) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "status" "WorkbookStatus" NOT NULL DEFAULT 'uploaded',
    "sheet_count" INTEGER,
    "row_count" INTEGER,
    "column_count" INTEGER,
    "summary_md" TEXT,
    "summary_json" JSONB,
    "parse_error" TEXT,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workbook_sheets" (
    "id" UUID NOT NULL,
    "workbook_id" UUID NOT NULL,
    "sheet_name" VARCHAR(255) NOT NULL,
    "sheet_index" INTEGER NOT NULL,
    "header_json" JSONB,
    "column_types_json" JSONB,
    "formula_columns_json" JSONB,
    "sample_rows_json" JSONB,
    "summary_md" TEXT,
    "row_count" INTEGER,
    "column_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workbook_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_threads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workbook_id" UUID,
    "title" VARCHAR(255),
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assistant_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "role" "AssistantRole" NOT NULL,
    "content" TEXT NOT NULL,
    "content_json" JSONB,
    "metadata_json" JSONB,
    "ai_request_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pivot_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workbook_id" UUID NOT NULL,
    "sheet_name" VARCHAR(255) NOT NULL,
    "prompt" TEXT NOT NULL,
    "config_json" JSONB,
    "result_json" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "ai_request_id" UUID,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "pivot_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workbook_id" UUID NOT NULL,
    "scope_json" JSONB,
    "prompt" TEXT NOT NULL,
    "summary_md" TEXT,
    "insights_json" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "complexity" VARCHAR(16),
    "ai_request_id" UUID,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workbook_id" UUID NOT NULL,
    "analysis_job_id" UUID,
    "prompt" TEXT NOT NULL,
    "chart_type" VARCHAR(64),
    "config_json" JSONB,
    "preview_json" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "ai_request_id" UUID,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "chart_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workbook_id" UUID NOT NULL,
    "analysis_job_id" UUID,
    "prompt" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL DEFAULT 'md',
    "content_md" TEXT,
    "export_file_url" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "complexity" VARCHAR(16),
    "ai_request_id" UUID,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tool_type" "ToolType" NOT NULL,
    "model_provider" VARCHAR(32) NOT NULL,
    "model_name" VARCHAR(64) NOT NULL,
    "prompt_version" VARCHAR(32),
    "input_ref_json" JSONB,
    "output_ref_json" JSONB,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "cost_usd" DECIMAL(12,6),
    "status" VARCHAR(32) NOT NULL,
    "error_code" VARCHAR(64),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "metric_type" "UsageMetricType" NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tool_type" "ToolType" NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "request_id" UUID,
    "source_job_id" UUID,
    "source_job_type" VARCHAR(32),
    "credit_delta" INTEGER NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_plan_idx" ON "users"("plan");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at" DESC);

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_provider_subscription_id_idx" ON "subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "billing_webhook_events_provider_subscription_id_idx" ON "billing_webhook_events"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "billing_webhook_events_event_type_idx" ON "billing_webhook_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhook_events_provider_provider_event_id_key" ON "billing_webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "workbooks_user_id_created_at_idx" ON "workbooks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "workbooks_status_idx" ON "workbooks"("status");

-- CreateIndex
CREATE INDEX "workbook_sheets_workbook_id_idx" ON "workbook_sheets"("workbook_id");

-- CreateIndex
CREATE INDEX "workbook_sheets_workbook_id_sheet_name_idx" ON "workbook_sheets"("workbook_id", "sheet_name");

-- CreateIndex
CREATE UNIQUE INDEX "workbook_sheets_workbook_id_sheet_index_key" ON "workbook_sheets"("workbook_id", "sheet_index");

-- CreateIndex
CREATE INDEX "assistant_threads_user_id_updated_at_idx" ON "assistant_threads"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "assistant_threads_workbook_id_idx" ON "assistant_threads"("workbook_id");

-- CreateIndex
CREATE INDEX "assistant_messages_thread_id_created_at_idx" ON "assistant_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "pivot_jobs_user_id_created_at_idx" ON "pivot_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pivot_jobs_workbook_id_idx" ON "pivot_jobs"("workbook_id");

-- CreateIndex
CREATE INDEX "pivot_jobs_status_idx" ON "pivot_jobs"("status");

-- CreateIndex
CREATE INDEX "analysis_jobs_user_id_created_at_idx" ON "analysis_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analysis_jobs_status_idx" ON "analysis_jobs"("status");

-- CreateIndex
CREATE INDEX "chart_jobs_user_id_created_at_idx" ON "chart_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "chart_jobs_status_idx" ON "chart_jobs"("status");

-- CreateIndex
CREATE INDEX "report_jobs_user_id_created_at_idx" ON "report_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "report_jobs_status_idx" ON "report_jobs"("status");

-- CreateIndex
CREATE INDEX "ai_requests_user_id_created_at_idx" ON "ai_requests"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_requests_tool_type_idx" ON "ai_requests"("tool_type");

-- CreateIndex
CREATE INDEX "ai_requests_model_name_idx" ON "ai_requests"("model_name");

-- CreateIndex
CREATE INDEX "usage_counters_user_id_idx" ON "usage_counters"("user_id");

-- CreateIndex
CREATE INDEX "usage_counters_period_end_idx" ON "usage_counters"("period_end");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_user_id_metric_type_period_type_period_start_key" ON "usage_counters"("user_id", "metric_type", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "usage_events_user_id_created_at_idx" ON "usage_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "usage_events_request_id_idx" ON "usage_events"("request_id");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workbooks" ADD CONSTRAINT "workbooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workbook_sheets" ADD CONSTRAINT "workbook_sheets_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "workbooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "assistant_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pivot_jobs" ADD CONSTRAINT "pivot_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pivot_jobs" ADD CONSTRAINT "pivot_jobs_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_jobs" ADD CONSTRAINT "chart_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_jobs" ADD CONSTRAINT "chart_jobs_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_jobs" ADD CONSTRAINT "chart_jobs_analysis_job_id_fkey" FOREIGN KEY ("analysis_job_id") REFERENCES "analysis_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_workbook_id_fkey" FOREIGN KEY ("workbook_id") REFERENCES "workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_analysis_job_id_fkey" FOREIGN KEY ("analysis_job_id") REFERENCES "analysis_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
