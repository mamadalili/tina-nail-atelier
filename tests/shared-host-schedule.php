<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';

function checkSchedule(bool $ok, string $reason): void { if (!$ok) throw new RuntimeException($reason); }
function rejectSchedule(callable $operation, string $code, int $status = 409): BookingFailure {
    try { $operation(); } catch (BookingFailure $failure) {
        checkSchedule($failure->errorCode === $code && $failure->status === $status, "Expected $code/$status, got {$failure->errorCode}/{$failure->status}");
        return $failure;
    }
    throw new RuntimeException("Expected $code");
}
$dir = sys_get_temp_dir().'/tina-staff-schedule-'.bin2hex(random_bytes(5));
mkdir($dir, 0700);
try {
    $store = new BookingStore($dir.'/appointments.sqlite');
    $now = new DateTimeImmutable('2026-11-04T08:00:00Z'); // Wednesday 1405-08-13, 11:30 Tehran.
    $periods = ['10-12','12-14','14-16','16-18'];
    $week = array_fill(0, 7, $periods);
    $open = ['staff'=>'tina','version'=>1,'week'=>$week,'daysOff'=>[]];
    checkSchedule($store->schedule('tina') === $open && $store->schedule('sonia') === array_replace($open, ['staff'=>'sonia']), 'Existing calendars start open and independent');
    $save = fn(array $body) => $store->saveSchedule($body, $now);
    $longRange = array_replace($store->schedule('sonia'), ['daysOff'=>['1407-01-01']]);
    checkSchedule($save($longRange)['daysOff'] === ['1407-01-01'], 'Managers can plan leave beyond the public 90-day booking horizon');
    $rules = $open;
    $rules['week'][0] = ['14-16','12-14']; // Saturday; canonicalize to time order.
    $rules['week'][6] = []; // Friday.
    $rules['daysOff'] = ['1405-08-19','1405-08-17'];
    $tooMany = [];
    foreach ([1407,1408] as $year) for ($month=1; $month<=12; $month++) for ($day=1; $day<=28; $day++) $tooMany[] = sprintf('%04d-%02d-%02d',$year,$month,$day);
    foreach ([['staff'=>'unknown'], ['version'=>false], ['week'=>array_slice($week,1)], ['week'=>array_replace($week,[3=>['08-10']])], ['week'=>array_replace($week,[3=>['12-14','12-14']])], ['week'=>array_replace($week,[3=>'12-14'])], ['daysOff'=>['1405-12-30']], ['daysOff'=>['1405-08-12']], ['daysOff'=>['1405-08-17','1405-08-17']], ['daysOff'=>array_slice($tooMany, 0, 367)]] as $bad) {
        rejectSchedule(fn()=>$save(array_replace($rules,$bad)), 'VALIDATION', 422);
    }
    $expected = $rules;
    $expected['week'][0] = ['12-14','14-16']; $expected['daysOff'] = ['1405-08-17','1405-08-19']; $expected['version'] = 2;
    checkSchedule($save($rules) === $expected && (new BookingStore($dir.'/appointments.sqlite'))->schedule('tina') === $expected, 'Validated hours and leave days persist in chronological order');
    rejectSchedule(fn()=>$save($open), 'STALE_SCHEDULE');
    checkSchedule($store->availability('1405-08-15', $now)['taken'] === $periods, 'Friday (index six) is fully closed');
    checkSchedule($store->availability('1405-08-16', $now)['taken'] === ['10-12','16-18'], 'Saturday (index zero) has only the selected hours open');
    checkSchedule($store->availability('1405-08-17', $now)['taken'] === $periods && $store->availability('1405-08-17', $now, 'sonia')['taken'] === [], 'Leave closes the complete day for one artist');
    $store->setBlocked('1405-08-16', '10-12', true, $now);
    $store->setBlocked('1405-08-16', '14-16', true, $now);
    $forSaturday = static fn(array $slot) => $slot['date'] === '1405-08-16' && $slot['staff'] === 'tina';
    $options = array_values(array_filter($store->bookingOptions($now)['taken'], $forSaturday));
    checkSchedule(array_column($options, 'period') === ['10-12','14-16','16-18'] && array_keys($options[0]) === ['staff','date','period'], 'Public options merge occupied and closed slots once and expose no reason');
    $blocks = array_values(array_filter($store->adminMonth('1405-08', 'tina', $now)['blocks'], $forSaturday));
    checkSchedule(array_column($blocks, 'period') === ['10-12','14-16','16-18'] && $blocks[0]['source'] === 'schedule' && ($blocks[1]['source'] ?? 'manual') === 'manual' && $blocks[2]['source'] === 'schedule', 'The private calendar distinguishes weekly closure even when it overlaps a manual block');
    checkSchedule($store->adminMonth('1405-07', 'tina', $now)['blocks'] === [], 'New weekly rules never invent historical closures');
    $data = ['name'=>'مهمان آزمایشی','phone'=>'09000000000','service'=>'pedicure','date'=>'1405-08-18','period'=>'12-14','consent'=>true];
    $key = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff401';
    $other = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff402';
    $reference = $store->reserve($key, $data, 'one', $now)['receipt']['reference'];
    $tinaProof = ['reference'=>$reference,'requestKey'=>$key];
    $store->reserve($other, array_replace($data, ['staff'=>'sonia','date'=>'1405-08-17']), 'two', $now);
    rejectSchedule(fn()=>$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff403', array_replace($data,['date'=>'1405-08-19']), 'three', $now), 'SLOT_TAKEN');
    rejectSchedule(fn()=>$store->adminUpdate($reference, 1, array_replace($data,['date'=>'1405-08-15']), $now), 'SLOT_TAKEN');
    rejectSchedule(fn()=>$store->changeGuestReceipt($tinaProof + ['action'=>'reschedule','version'=>1,'date'=>'1405-08-16','period'=>'16-18'], $now), 'SLOT_TAKEN');
    $clash = $expected; $clash['daysOff'][] = '1405-08-18';
    $failure = rejectSchedule(fn()=>$save($clash), 'SCHEDULE_CONFLICT');
    checkSchedule($failure->conflicts === [['reference'=>$reference, 'date'=>'1405-08-18', 'period'=>'12-14']], 'A private conflict list contains only the affected reference and slot');
    $weeklyClash = $expected; $weeklyClash['week'][2] = [];
    rejectSchedule(fn()=>$save($weeklyClash), 'SCHEDULE_CONFLICT');
    $futureDay = '1407-01-02'; // Simulate an existing advance booking, outside the public booking window at save time.
    $futureRef = $store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff411', array_replace($data,['date'=>$futureDay]), 'advance', new DateTimeImmutable('2028-03-10'))['receipt']['reference'];
    $farClash = $expected; $farClash['daysOff'][] = $futureDay;
    $farFailure = rejectSchedule(fn()=>$save($farClash), 'SCHEDULE_CONFLICT');
    checkSchedule($farFailure->conflicts === [['reference'=>$futureRef,'date'=>$futureDay,'period'=>'12-14']], 'Changing a future holiday checks confirmed bookings beyond the public booking window');
    checkSchedule($store->schedule('tina') === $expected && $store->guestReceipt($reference,$key)['version'] === 1, 'Rejected schedule changes do not alter rules or the affected booking');
    $store->adminCancel($reference, 1, $now);
    checkSchedule($save($clash)['version'] === 3, 'Cancelled appointments do not prevent closure');
    $later = new DateTimeImmutable('2026-11-10T08:31:00Z');
    $updated = array_replace($store->schedule('tina'), ['week'=>$week]);
    $updated = $store->saveSchedule($updated, $later);
    checkSchedule(in_array('1405-08-17',$updated['daysOff'],true), 'Unchanged saves can round-trip previously recorded leave after the date passes');
    $omit = $updated; $omit['daysOff'] = array_values(array_diff($omit['daysOff'], ['1405-08-17']));
    $without = $store->saveSchedule($omit, $later);
    $restore = $without; $restore['daysOff'][] = '1405-08-17';
    rejectSchedule(fn()=>$store->saveSchedule($restore, $later), 'VALIDATION', 422);
    $reopened = $store->availability('1405-08-16', $now)['taken'];
    checkSchedule($reopened === ['10-12','14-16'], 'Reopening weekly hours preserves both independent manual closures');
    $exact = $store->schedule('sonia'); $exact['week'][1] = [];
    $afterStart = new DateTimeImmutable('2026-11-08T08:30:00Z');
    checkSchedule($store->saveSchedule($exact, $afterStart)['version'] === 3, 'An appointment at its exact start time no longer prevents saving future weekly hours');
    echo "PASS staff schedule: weekdays, leave, validation, optimistic saves, conflict safety, private vs public closures, and booking enforcement\n";
} finally {
    unset($save, $store);
    foreach (glob($dir.'/*') as $file) unlink($file);
    rmdir($dir);
}
