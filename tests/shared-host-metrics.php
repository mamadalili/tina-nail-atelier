<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingMetrics.php';

function check(mixed $actual, mixed $expected): void {
    if ($actual !== $expected) throw new RuntimeException('Expected '.json_encode($expected).', received '.json_encode($actual));
}

$path = tempnam(sys_get_temp_dir(), 'tina-metrics-');
try {
    $metrics = new BookingMetrics($path);
    $now = 1800000000;
    $id = static fn(int $i) => sprintf('00000000-0000-4000-8000-%012x', $i);
    $event = static fn(int $i, string $event) => ['id'=>$id($i), 'event'=>$event];
    $empty = ['days'=>30,'starts'=>0,'selections'=>0,'receipts'=>0,'medianMs'=>null];
    check($metrics->report($now), $empty);
    foreach ([['id'=>'0','event'=>'start'], $event(1, 'selected'), $event(1, 'selected') + ['elapsedMs'=>-1],
        $event(1, 'selected') + ['elapsedMs'=>86400001], $event(1, 'start') + ['name'=>'guest'], $event(1, 'receipt') + ['reference'=>'guest']] as $invalid) {
        check(BookingMetrics::validEvent($invalid), false);
    }
    $metrics->record($event(1, 'selected') + ['elapsedMs'=>55], $now);
    $metrics->record($event(1, 'receipt'), $now);
    check($metrics->report($now), $empty);
    // A genuine reservation may reach the server before a delayed start event.
    $metrics->issue($id(1), $now);
    check($metrics->report($now), $empty);
    foreach ([1=>12000, 2=>18000, 3=>100000] as $i=>$elapsed) {
        $metrics->record($event($i, 'start'), $now);
        $metrics->record($event($i, 'start'), $now);
        $metrics->record($event($i, 'selected') + ['elapsedMs'=>$elapsed], $now + 30);
        $metrics->record($event($i, 'selected') + ['elapsedMs'=>0], $now + 40);
        $metrics->record($event($i, 'receipt'), $now + 30);
        $metrics->record($event($i, 'receipt'), $now + 30);
    }
    $metrics->record($event(4, 'start'), $now);
    check($metrics->report($now+100), ['days'=>30,'starts'=>4,'selections'=>3,'receipts'=>1,'medianMs'=>18000.0]);
    $metrics->record($event(4, 'selected') + ['elapsedMs'=>2000], $now+110);
    check($metrics->report($now+120)['medianMs'], 15000.0);
    check($metrics->report($now+120,'week'), ['days'=>7,'starts'=>4,'selections'=>4,'receipts'=>1,'medianMs'=>15000.0]);
    check($metrics->report($now+120,'previous-week'), ['days'=>7,'starts'=>0,'selections'=>0,'receipts'=>0,'medianMs'=>null]);
    check($metrics->report($now+7*86400,'previous-week')['starts'], 0);
    check($metrics->report($now+7*86400,'week')['starts'], 4);
    check($metrics->report($now+7*86400+1,'previous-week')['medianMs'], 15000.0);
    $metrics->record($event(5, 'start'), $now+86401);
    $metrics->issue($id(4), $now+86401);
    $metrics->record($event(4, 'receipt'), $now+86401);
    check($metrics->report($now+86401)['receipts'], 1);
    check($metrics->report($now + 31*86400 + 2), $empty);
    $metrics->record($event(6, 'start'), $now + 31*86400 + 2);
    $db = new PDO('sqlite:'.$path);
    check((int)$db->query('SELECT COUNT(*) FROM booking_journeys')->fetchColumn(), 1);
    for ($i=7; $i<1006; $i++) $metrics->record($event($i, 'start'), $now + 31*86400 + 2);
    check($metrics->record($event(1006, 'start'), $now + 31*86400 + 2), false);
    check($metrics->record($event(6, 'start'), $now + 31*86400 + 2), true);
    echo "PASS anonymous metrics: validation, first choice, authority, replay, median, retention and rate limit\n";
} finally { unlink($path); }
