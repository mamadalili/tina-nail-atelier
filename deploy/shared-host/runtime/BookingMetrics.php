<?php
declare(strict_types=1);

final class BookingMetrics {
    private PDO $db;
    private const DAY = 86400;
    private const DAYS_REPORTED = 30;
    private const HOURLY_START_LIMIT = 1000;

    public function __construct(string $path) {
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory,0700,true) && !is_dir($directory)) throw new RuntimeException('METRICS_STORAGE');
        $this->db = new PDO('sqlite:'.$path, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $this->db->exec('PRAGMA busy_timeout=500');
        $this->db->exec('CREATE TABLE IF NOT EXISTS booking_journeys (
            id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, started INTEGER NOT NULL DEFAULT 0,
            elapsed_ms INTEGER, receipt_issued INTEGER NOT NULL DEFAULT 0, receipt_seen INTEGER NOT NULL DEFAULT 0
        )');
        $this->db->exec('CREATE INDEX IF NOT EXISTS booking_journeys_created ON booking_journeys(created_at)');
        @chmod($path,0600);
    }

    public static function validId(mixed $id): bool {
        return is_string($id) && preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',$id) === 1;
    }

    public static function validEvent(mixed $input): bool {
        if (!is_array($input) || !self::validId($input['id'] ?? null)) return false;
        if (($input['event'] ?? null) === 'selected') {
            $elapsed = $input['elapsedMs'] ?? null;
            return count($input) === 3 && is_int($elapsed) && $elapsed >= 0 && $elapsed <= self::DAY * 1000;
        }
        return count($input) === 2 && in_array($input['event'] ?? null,['start','receipt'],true);
    }

    public function record(array $event, int $now): bool {
        if (!self::validEvent($event)) throw new InvalidArgumentException('INVALID_METRIC_EVENT');
        $id = $event['id'];
        if ($event['event'] === 'start') {
            $this->db->exec('BEGIN IMMEDIATE');
            try {
                $this->db->prepare('DELETE FROM booking_journeys WHERE created_at < ?')->execute([$now - self::DAYS_REPORTED * self::DAY]);
                $insert = $this->db->prepare('INSERT INTO booking_journeys(id,created_at,started)
                    SELECT ?,?,1 WHERE EXISTS (SELECT 1 FROM booking_journeys WHERE id=?)
                    OR (SELECT COUNT(*) FROM booking_journeys WHERE created_at >= ?) < ?
                    ON CONFLICT(id) DO UPDATE SET started=1');
                $insert->bindValue(1,$id);
                $insert->bindValue(2,$now,PDO::PARAM_INT);
                $insert->bindValue(3,$id);
                $insert->bindValue(4,$now-3600,PDO::PARAM_INT);
                $insert->bindValue(5,self::HOURLY_START_LIMIT,PDO::PARAM_INT);
                $insert->execute();
                $accepted = $insert->rowCount() > 0;
                $this->db->exec('COMMIT');
                return $accepted;
            } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
        }
        if ($event['event'] === 'selected') {
            $this->db->prepare('UPDATE booking_journeys SET elapsed_ms=? WHERE id=? AND started=1 AND elapsed_ms IS NULL AND created_at >= ?')
                ->execute([$event['elapsedMs'],$id,$now-self::DAY]);
        } else {
            $this->db->prepare('UPDATE booking_journeys SET receipt_seen=1 WHERE id=? AND started=1 AND receipt_issued=1 AND created_at >= ?')
                ->execute([$id,$now-self::DAY]);
        }
        return true;
    }

    // Only the successful first confirmation may grant this journey permission to count a receipt.
    public function issue(string $id, int $now): void {
        if (!self::validId($id)) return;
        $this->db->prepare('INSERT INTO booking_journeys(id,created_at,receipt_issued) VALUES (?,?,1)
            ON CONFLICT(id) DO UPDATE SET receipt_issued=1')->execute([$id,$now]);
    }

    public function report(int $now, string $period='month'): array {
        $days = $period === 'month' ? self::DAYS_REPORTED : 7;
        $previous = $period === 'previous-week';
        $from = $now - ($previous ? 14 : $days)*self::DAY;
        $until = $previous ? $now-7*self::DAY : $now+1;
        $q = $this->db->prepare('WITH cohort AS (
            SELECT elapsed_ms,receipt_seen FROM booking_journeys WHERE started=1 AND created_at >= ? AND created_at < ?
        ), times AS (
            SELECT elapsed_ms, ROW_NUMBER() OVER (ORDER BY elapsed_ms) AS position, COUNT(*) OVER () AS total
            FROM cohort WHERE elapsed_ms IS NOT NULL
        )
        SELECT COUNT(*) AS starts, COUNT(elapsed_ms) AS selections, COALESCE(SUM(receipt_seen),0) AS receipts,
            (SELECT AVG(elapsed_ms) FROM times WHERE position BETWEEN (total+1)/2 AND (total+2)/2) AS median_ms
        FROM cohort');
        $q->execute([$from,$until]);
        $row = $q->fetch(PDO::FETCH_ASSOC);
        return ['days'=>$days,'starts'=>(int)$row['starts'],'selections'=>(int)$row['selections'],
            'receipts'=>(int)$row['receipts'],'medianMs'=>$row['median_ms'] === null ? null : (float)$row['median_ms']];
    }
}
