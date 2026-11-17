<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';

const GUEST_KEY = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff601';
const REQUEST = ['name'=>'Race Guest','phone'=>'09000000000','service'=>'pedicure','date'=>'1405-08-17','period'=>'12-14','consent'=>true];
$now = new DateTimeImmutable('2026-11-04T08:00:00Z');

function waitForFiles(array $files): void {
    $end = microtime(true) + 10;
    do {
        clearstatcache();
        if (count(array_filter($files, 'is_file')) === count($files)) return;
        usleep(2000);
    } while (microtime(true) < $end);
    throw new RuntimeException('A race participant did not reach the barrier');
}

if (($argv[1] ?? null) === 'worker') {
    [,,$dir,$batch,$role,$reference] = $argv;
    $store = new BookingStore($dir.'/appointments.sqlite');
    $gate = $dir.'/'.$batch;
    touch($gate.'-'.$role);
    waitForFiles([$gate]);
    try {
        if ($role === 'close') {
            $schedule = $store->schedule('tina');
            $schedule['daysOff'] = ['1405-08-17'];
            $store->saveSchedule($schedule, $now);
            echo 'CLOSED';
        } elseif ($role === 'reserve') {
            $store->reserve(GUEST_KEY, REQUEST, 'guest', $now);
            echo 'BOOKED';
        } else {
            $store->changeGuestReceipt(['reference'=>$reference,'requestKey'=>GUEST_KEY,'action'=>'reschedule','version'=>1,'date'=>'1405-08-18','period'=>$role], $now);
            echo 'MOVED';
        }
    } catch (BookingFailure $failure) { echo $failure->errorCode; }
    exit;
}

function compete(string $dir, string $batch, array $roles, string $reference = ''): array {
    $php = [PHP_BINARY];
    $ext = ini_get('extension_dir').'/'.(PHP_OS_FAMILY === 'Windows' ? 'php_pdo_sqlite.dll' : 'pdo_sqlite.so');
    if (is_file($ext)) array_push($php, '-d', 'display_errors=stderr', '-d', 'extension_dir='.ini_get('extension_dir'), '-d', 'extension=pdo_sqlite');
    $workers = [];
    try {
        foreach ($roles as $role) {
            $process = proc_open([...$php,__FILE__,'worker',$dir,$batch,$role,$reference], [1=>['pipe','w'],2=>['pipe','w']], $pipes);
            if (!is_resource($process)) throw new RuntimeException('Could not start a race participant');
            $workers[] = [$process,$pipes];
        }
        waitForFiles(array_map(fn($role)=>$dir.'/'.$batch.'-'.$role, $roles));
        touch($dir.'/'.$batch);
        $outcomes = [];
        foreach ($workers as [$process,$pipes]) {
            $outcomes[] = trim(stream_get_contents($pipes[1]));
            $errors = stream_get_contents($pipes[2]);
            fclose($pipes[1]); fclose($pipes[2]);
            if (proc_close($process) !== 0) throw new RuntimeException($errors);
        }
        sort($outcomes);
        return $outcomes;
    } finally {
        foreach ($workers as [$process]) if (is_resource($process)) { proc_terminate($process); proc_close($process); }
    }
}

$dir = sys_get_temp_dir().'/tina-change-races-'.bin2hex(random_bytes(5));
mkdir($dir, 0700);
try {
    $store = new BookingStore($dir.'/appointments.sqlite');
    $outcomes = compete($dir, 'booking-against-leave', ['reserve','close']);
    $month = $store->adminMonth('1405-08','tina',$now);
    if ($outcomes === ['BOOKED','SCHEDULE_CONFLICT']) {
        if (count($month['appointments']) !== 1 || $month['blocks']) throw new RuntimeException('Reservation winner must retain the open hours');
        $reference = $month['appointments'][0]['reference'];
    } elseif ($outcomes === ['CLOSED','SLOT_TAKEN']) {
        if ($month['appointments'] || count($month['blocks']) !== 4) throw new RuntimeException('Schedule winner must exclude the competing booking');
        $hours = $store->schedule('tina'); $hours['daysOff'] = []; $store->saveSchedule($hours, $now);
        $reference = $store->reserve(GUEST_KEY, REQUEST, 'guest', $now)['receipt']['reference'];
    } else { throw new RuntimeException('Unexpected reserve/close results: '.implode(',', $outcomes)); }
    if (compete($dir, 'competing-edits', ['10-12','14-16'], $reference) !== ['MOVED','STALE_BOOKING']) throw new RuntimeException('Two tabs cannot move the same booking from the same version');
    $receipt = $store->guestReceipt($reference, GUEST_KEY);
    if ($receipt['version'] !== 2 || $store->availability('1405-08-18',$now)['taken'] !== [$receipt['period']] || $store->availability('1405-08-17',$now)['taken'] !== []) {
        throw new RuntimeException('The winner occupies only its target slot');
    }
    echo "PASS cross-process writes: booking versus new leave and two competing guest moves\n";
} finally {
    unset($store);
    foreach (glob($dir.'/*') as $file) unlink($file);
    rmdir($dir);
}
