ALTER TABLE "AppointmentRequest" ADD COLUMN "staff" VARCHAR(20) NOT NULL DEFAULT 'tina';
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "appointment_known_staff" CHECK ("staff" IN ('tina', 'sonia'));
DROP INDEX "AppointmentRequest_confirmed_slot_key";
CREATE UNIQUE INDEX "AppointmentRequest_confirmed_slot_key"
ON "AppointmentRequest"("staff", "jalaliDay", "period") WHERE "status" = 'CONFIRMED';
