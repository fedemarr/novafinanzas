-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('OFFICIAL', 'BLUE', 'MEP', 'CCL', 'MARKET');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BANK', 'WALLET', 'CASH', 'CRYPTO', 'INVESTMENT', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'IGNORED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('EMAIL', 'IMPORT', 'MANUAL', 'RECURRING');

-- CreateEnum
CREATE TYPE "CommitmentKind" AS ENUM ('CARD_INSTALLMENT', 'SUBSCRIPTION', 'FIXED_EXPENSE', 'LOAN', 'DEBT');

-- CreateEnum
CREATE TYPE "CommitmentOccurrenceStatus" AS ENUM ('SCHEDULED', 'PAID', 'SKIPPED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "RecurringIncomeOccurrenceStatus" AS ENUM ('EXPECTED', 'RECEIVED', 'SKIPPED', 'LATE');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoalPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('PENDING', 'PARSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "base_currency_code" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "preferred_rate_type" "RateType" NOT NULL,
    "pay_cycle_day" INTEGER NOT NULL,
    "ingest_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_currency_code" TEXT NOT NULL,
    "default_rate_type" "RateType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "is_crypto" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "base_currency_code" TEXT NOT NULL,
    "quote_currency_code" TEXT NOT NULL,
    "rate_type" "RateType" NOT NULL,
    "rate" DECIMAL(30,10) NOT NULL,
    "valid_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inflation_indices" (
    "id" UUID NOT NULL,
    "country_code" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "index_value" DECIMAL(30,10) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inflation_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency_code" TEXT NOT NULL,
    "institution_key" TEXT,
    "is_liquid" BOOLEAN NOT NULL,
    "initial_balance" DECIMAL(30,10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(30,10) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "fx_rate_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "merchant_raw" TEXT,
    "merchant_normalized" TEXT,
    "category_id" UUID,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "source" "TransactionSource" NOT NULL,
    "source_ref" TEXT,
    "dedupe_hash" TEXT NOT NULL,
    "counter_account_id" UUID,
    "commitment_occurrence_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "parent_id" UUID,
    "is_system" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "CommitmentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "currency_code" TEXT NOT NULL,
    "total_amount" DECIMAL(30,10) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "recurrence_rule" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitment_occurrences" (
    "id" UUID NOT NULL,
    "commitment_id" UUID NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(30,10) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "status" "CommitmentOccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "installment_number" INTEGER,
    "installment_total" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "commitment_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_incomes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "currency_code" TEXT NOT NULL,
    "expected_amount" DECIMAL(30,10) NOT NULL,
    "recurrence_rule" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recurring_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_income_occurrences" (
    "id" UUID NOT NULL,
    "recurring_income_id" UUID NOT NULL,
    "expected_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(30,10) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "status" "RecurringIncomeOccurrenceStatus" NOT NULL DEFAULT 'EXPECTED',
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recurring_income_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount" DECIMAL(30,10) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "target_date" TIMESTAMP(3),
    "account_id" UUID,
    "monthly_contribution" DECIMAL(30,10) NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "GoalPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "from_address" TEXT NOT NULL,
    "subject" TEXT,
    "raw_body" TEXT NOT NULL,
    "parser_key" TEXT,
    "parse_status" "ParseStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" UUID,
    "error_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "balance" DECIMAL(30,10) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_ingest_address_key" ON "users"("ingest_address");

-- CreateIndex
CREATE INDEX "exchange_rates_base_currency_code_quote_currency_code_rate__idx" ON "exchange_rates"("base_currency_code", "quote_currency_code", "rate_type", "valid_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_code_quote_currency_code_rate__key" ON "exchange_rates"("base_currency_code", "quote_currency_code", "rate_type", "valid_at");

-- CreateIndex
CREATE UNIQUE INDEX "inflation_indices_country_code_period_key" ON "inflation_indices"("country_code", "period");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_commitment_occurrence_id_key" ON "transactions"("commitment_occurrence_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_occurred_at_idx" ON "transactions"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_id_dedupe_hash_key" ON "transactions"("user_id", "dedupe_hash");

-- CreateIndex
CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");

-- CreateIndex
CREATE INDEX "commitments_user_id_idx" ON "commitments"("user_id");

-- CreateIndex
CREATE INDEX "commitment_occurrences_commitment_id_idx" ON "commitment_occurrences"("commitment_id");

-- CreateIndex
CREATE INDEX "commitment_occurrences_due_date_idx" ON "commitment_occurrences"("due_date");

-- CreateIndex
CREATE INDEX "commitment_occurrences_status_idx" ON "commitment_occurrences"("status");

-- CreateIndex
CREATE INDEX "recurring_incomes_user_id_idx" ON "recurring_incomes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_income_occurrences_transaction_id_key" ON "recurring_income_occurrences"("transaction_id");

-- CreateIndex
CREATE INDEX "recurring_income_occurrences_recurring_income_id_idx" ON "recurring_income_occurrences"("recurring_income_id");

-- CreateIndex
CREATE INDEX "recurring_income_occurrences_expected_date_idx" ON "recurring_income_occurrences"("expected_date");

-- CreateIndex
CREATE INDEX "recurring_income_occurrences_status_idx" ON "recurring_income_occurrences"("status");

-- CreateIndex
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_transaction_id_key" ON "inbound_messages"("transaction_id");

-- CreateIndex
CREATE INDEX "inbound_messages_user_id_idx" ON "inbound_messages"("user_id");

-- CreateIndex
CREATE INDEX "inbound_messages_parse_status_idx" ON "inbound_messages"("parse_status");

-- CreateIndex
CREATE INDEX "balance_snapshots_user_id_idx" ON "balance_snapshots"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "balance_snapshots_account_id_date_key" ON "balance_snapshots"("account_id", "date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_base_currency_code_fkey" FOREIGN KEY ("base_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_default_currency_code_fkey" FOREIGN KEY ("default_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_base_currency_code_fkey" FOREIGN KEY ("base_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_quote_currency_code_fkey" FOREIGN KEY ("quote_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inflation_indices" ADD CONSTRAINT "inflation_indices_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fx_rate_id_fkey" FOREIGN KEY ("fx_rate_id") REFERENCES "exchange_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counter_account_id_fkey" FOREIGN KEY ("counter_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_commitment_occurrence_id_fkey" FOREIGN KEY ("commitment_occurrence_id") REFERENCES "commitment_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_occurrences" ADD CONSTRAINT "commitment_occurrences_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_occurrences" ADD CONSTRAINT "commitment_occurrences_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_incomes" ADD CONSTRAINT "recurring_incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_incomes" ADD CONSTRAINT "recurring_incomes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_incomes" ADD CONSTRAINT "recurring_incomes_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_income_occurrences" ADD CONSTRAINT "recurring_income_occurrences_recurring_income_id_fkey" FOREIGN KEY ("recurring_income_id") REFERENCES "recurring_incomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_income_occurrences" ADD CONSTRAINT "recurring_income_occurrences_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_income_occurrences" ADD CONSTRAINT "recurring_income_occurrences_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
