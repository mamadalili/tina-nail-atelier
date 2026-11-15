ALTER TABLE "AppointmentRequest" ADD COLUMN "reference" VARCHAR(40);
UPDATE "AppointmentRequest" SET "reference" = 'TN-' || upper(replace("id"::text, '-', ''));
ALTER TABLE "AppointmentRequest" ALTER COLUMN "reference" SET NOT NULL;
CREATE UNIQUE INDEX "AppointmentRequest_reference_key" ON "AppointmentRequest"("reference");

-- Fixed, nonoverlapping two-hour periods share a single practitioner.
CREATE UNIQUE INDEX "AppointmentRequest_confirmed_slot_key"
ON "AppointmentRequest"("jalaliDay", "period") WHERE "status" = 'CONFIRMED';

ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "confirmed_appointment_times"
CHECK ("status" <> 'CONFIRMED' OR ("startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" = "startsAt" + interval '2 hours')) NOT VALID;

ALTER TABLE "OutboxEvent" ADD COLUMN "providerMessageId" VARCHAR(255);
