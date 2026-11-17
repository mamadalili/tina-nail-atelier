ALTER TABLE "AppointmentRequest" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1
  CHECK ("version" > 0);

-- Every writer, including direct staff corrections, invalidates older receipts.
CREATE FUNCTION advance_appointment_version() RETURNS trigger AS $$
BEGIN
  NEW."version" := OLD."version" + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER advance_appointment_version BEFORE UPDATE ON "AppointmentRequest"
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION advance_appointment_version();

CREATE TABLE "StaffSchedule" (
  "staff" VARCHAR(20) PRIMARY KEY CHECK ("staff" IN ('tina', 'sonia')),
  "week" JSONB NOT NULL CHECK (jsonb_typeof("week") = 'array' AND jsonb_array_length("week") = 7),
  "daysOff" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);
