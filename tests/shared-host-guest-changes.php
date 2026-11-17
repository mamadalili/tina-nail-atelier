<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';

function checkGuest(bool $ok, string $reason): void { if (!$ok) throw new RuntimeException($reason); }
function rejectGuest(callable $operation, string $code, int $status = 409): void {
    try { $operation(); } catch (BookingFailure $failure) {
        checkGuest($failure->errorCode === $code && $failure->status === $status, "Expected $code/$status, got {$failure->errorCode}/{$failure->status}");
        return;
    }
    throw new RuntimeException("Expected $code");
}

$dir = sys_get_temp_dir().'/tina-guest-changes-'.bin2hex(random_bytes(5));
mkdir($dir, 0700);
try {
    $store = new BookingStore($dir.'/appointments.sqlite');
    $now = new DateTimeImmutable('2026-11-04T08:00:00Z');
    $data = ['name'=>'مهمان آزمایشی','phone'=>'09120000000','service'=>'manicure','manicureType'=>'gel','staff'=>'sonia','date'=>'1405-08-14','period'=>'12-14','note'=>'یادداشت خصوصی','consent'=>true];
    $key = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff301';
    $otherKey = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff302';
    $issued = $store->reserve($key, $data, 'one', $now)['receipt'];
    $other = $store->reserve($otherKey, array_replace($data, ['date'=>'1405-08-16']), 'two', $now)['receipt'];
    $proof = ['reference'=>$issued['reference'], 'requestKey'=>$key];
    $cancel = $proof + ['action'=>'cancel','version'=>1];
    $move = $proof + ['action'=>'reschedule','version'=>1,'date'=>'1405-08-15','period'=>'16-18'];
    $change = function(array $body) use (&$store,$now) { return $store->changeGuestReceipt($body, $now); };
    checkGuest(($store->guestReceipt($issued['reference'], $key)['version'] ?? null) === 1, 'The saved receipt exposes its optimistic edit version');
    foreach ([['requestKey'=>$otherKey], ['reference'=>$other['reference']], ['reference'=>'TN-0000000000000000'], ['requestKey'=>'bad']] as $wrong) {
        checkGuest($change(array_replace($cancel, $wrong)) === null, 'A different or malformed proof cannot mutate or reveal a receipt');
    }
    foreach ([['action'=>'transfer'], ['version'=>0], ['version'=>'1'], ['staff'=>'tina'], ['name'=>'نسخهٔ دیگر'], ['period'=>['10-12']], ['date'=>'1405-12-30'], ['date'=>'1406-06-01']] as $invalid) {
        rejectGuest(fn()=>$change(array_replace($move, $invalid)), 'INVALID_REQUEST', 422);
    }
    rejectGuest(fn()=>$change(array_replace($move, ['date'=>'1405-08-16','period'=>'12-14'])), 'SLOT_TAKEN');
    $store->setBlocked('1405-08-15', '14-16', true, $now, 'sonia');
    rejectGuest(fn()=>$change(array_replace($move, ['period'=>'14-16'])), 'SLOT_TAKEN');
    checkGuest($store->availability('1405-08-14', $now, 'sonia')['taken'] === ['12-14'], 'Unavailable moves cannot release the original slot');
    $moved = $change($move);
    checkGuest($moved['version'] === 2 && $moved['startsAt'] === '2026-11-06T12:30:00.000Z', 'A guest moves their own appointment to the chosen Tehran slot');
    checkGuest($moved['reference'] === $issued['reference'] && $moved['name'] === $issued['name'] && $moved['service'] === $issued['service'] && $moved['treatment'] === 'ژلیش' && $moved['staff'] === 'sonia', 'A move preserves identity, artist and issued service');
    checkGuest(!array_intersect(['phone','note','requestKey','payload','consent'], array_keys($moved)), 'Guest responses contain no private contact or proof fields');
    checkGuest($store->availability('1405-08-14', $now, 'sonia')['taken'] === [], 'A successful move releases the original slot');
    $store = new BookingStore($dir.'/appointments.sqlite');
    checkGuest($store->changeGuestReceipt($move, $now->modify('+1 minute')) === $moved, 'Retrying an acknowledged or lost move response is read-only, even after reopening SQLite');
    rejectGuest(fn()=>$change($cancel), 'STALE_BOOKING');
    rejectGuest(fn()=>$change(array_replace($move, ['period'=>'12-14'])), 'STALE_BOOKING');
    checkGuest($store->reserve($key, $data, 'one', $now)['receipt']['date'] === '1405-08-15', 'Replaying the original booking request retrieves the moved appointment');
    $entry = $store->adminMonth('1405-08', 'sonia')['appointments'][0];
    checkGuest($entry['phone'] === $data['phone'] && $entry['note'] === $data['note'], 'Guest moves preserve the private fields seen by staff');
    $cancel['version'] = 2;
    $cancelled = $change($cancel);
    checkGuest($cancelled['version'] === 3 && $cancelled['status'] === 'CANCELLED' && $change($cancel) === $cancelled, 'Cancellation and its retry return one persisted cancellation');
    checkGuest($store->changeGuestReceipt($cancel, $now->modify('+1 week')) === $cancelled, 'A lost cancellation response can be recovered after the original appointment start');
    checkGuest($store->guestReceipt($issued['reference'], $key) === $cancelled && $store->availability('1405-08-15', $now, 'sonia')['taken'] === ['14-16'], 'Cancellation frees just the appointment and keeps its receipt');
    rejectGuest(fn()=>$store->reserve($key, $data, 'one', $now), 'BOOKING_CANCELLED');
    $audit = new PDO('sqlite:'.$dir.'/appointments.sqlite');
    $auditCount = $audit->prepare('SELECT count(*) FROM booking_history WHERE reference=?');
    $auditCount->execute([$issued['reference']]);
    checkGuest((int)$auditCount->fetchColumn() === 2, 'Retries leave exactly two audit events, one per accepted change');
    $otherProof = ['reference'=>$other['reference'],'requestKey'=>$otherKey];
    $otherMove = $otherProof + ['action'=>'reschedule','version'=>1,'date'=>'1405-08-14','period'=>'12-14'];
    $exactTargetStart = new DateTimeImmutable('2026-11-05T08:30:00Z');
    rejectGuest(fn()=>$store->changeGuestReceipt($otherMove, $exactTargetStart), 'TARGET_STARTED');
    checkGuest($store->guestReceipt($other['reference'], $otherKey)['date'] === $other['date'], 'A target that just started leaves the future original intact');
    $exactOriginalStart = new DateTimeImmutable('2026-11-07T08:30:00Z');
    rejectGuest(fn()=>$store->changeGuestReceipt($otherProof + ['action'=>'cancel','version'=>1], $exactOriginalStart), 'BOOKING_STARTED');
    rejectGuest(fn()=>$store->changeGuestReceipt(array_replace($otherMove, ['date'=>'1405-08-17']), $exactOriginalStart), 'BOOKING_STARTED');
    checkGuest($store->guestReceipt($other['reference'], $otherKey)['version'] === 1, 'Started appointments remain unchanged');
    echo "PASS guest changes: proof, restricted inputs, atomic move/cancel, stale edits, replay, audit and Tehran start boundary\n";
} finally {
    unset($change, $store, $auditCount, $audit);
    foreach (glob($dir.'/*') as $file) unlink($file);
    rmdir($dir);
}
