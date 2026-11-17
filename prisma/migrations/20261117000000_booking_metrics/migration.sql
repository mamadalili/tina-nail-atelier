CREATE TABLE "BookingJourney" (
    "id" UUID PRIMARY KEY,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started" BOOLEAN NOT NULL DEFAULT FALSE,
    "elapsedMs" INTEGER CHECK ("elapsedMs" BETWEEN 0 AND 86400000),
    "receiptIssued" BOOLEAN NOT NULL DEFAULT FALSE,
    "receiptSeen" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX "BookingJourney_createdAt_idx" ON "BookingJourney"("createdAt");
