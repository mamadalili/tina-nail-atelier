-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AppointmentRequest" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(11) NOT NULL,
    "service" VARCHAR(20) NOT NULL,
    "preferredDay" DATE NOT NULL,
    "jalaliDay" VARCHAR(10) NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRequest_idempotencyKey_key" ON "AppointmentRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AppointmentRequest_createdAt_idx" ON "AppointmentRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AppointmentRequest_status_preferredDay_idx" ON "AppointmentRequest"("status", "preferredDay");

-- CreateIndex
CREATE INDEX "OutboxEvent_sentAt_retryAt_idx" ON "OutboxEvent"("sentAt", "retryAt");

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AppointmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
