<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';

function checkReceipt(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$dir = sys_get_temp_dir().'/tina-guest-receipt-'.bin2hex(random_bytes(5));
mkdir($dir, 0700);
try {
    $store = new BookingStore($dir.'/test.sqlite');
    $now = new DateTimeImmutable('2026-11-04T08:00:00Z');
    $data = ['name'=>'مهمان آزمایشی', 'phone'=>'09120000000', 'service'=>'manicure', 'date'=>'1405-08-14', 'period'=>'12-14', 'note'=>'یادداشت خصوصی', 'consent'=>true];
    $firstKey = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff101';
    $otherKey = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff102';
    $first = $store->reserve($firstKey, $data, 'local', $now)['receipt'];
    $other = $store->reserve($otherKey, array_replace($data, ['staff'=>'sonia']), 'local', $now)['receipt'];
    $ref = $first['reference'];
    foreach ([[$ref, ''], [$ref, $otherKey], [$other['reference'], $firstKey], ['TN-0000000000000000', $firstKey]] as [$reference, $key]) {
        checkReceipt($store->guestReceipt($reference, $key) === null, 'Both credentials must identify the same booking');
    }
    $current = $store->guestReceipt($ref, $firstKey);
    checkReceipt($current['startsAt'] === '2026-11-05T08:30:00.000Z' && $current['status'] === 'CONFIRMED', 'Current Tehran slot is returned');
    checkReceipt(!array_intersect(['phone', 'note', 'requestKey', 'payload'], array_keys($current)), 'Contact details, private notes and credentials are excluded');
    $later = $now->modify('+1 hour');
    $store->adminUpdate($ref, 1, array_replace($data, ['name'=>'مهمان ویرایش‌شده', 'service'=>'pedicure', 'date'=>'1405-08-15', 'period'=>'16-18', 'staff'=>'sonia']), $later);
    $moved = $store->guestReceipt($ref, $firstKey);
    checkReceipt($moved['name'] === 'مهمان ویرایش‌شده' && $moved['service'] === 'خدمات پا' && $moved['staff'] === 'sonia', 'Edits and staff transfers appear on the original receipt');
    checkReceipt($moved['date'] === '1405-08-15' && $moved['period'] === '16-18' && $moved['startsAt'] === '2026-11-06T12:30:00.000Z', 'A moved appointment has the new calendar instant');
    $store->adminCancel($ref, 2, $later->modify('+1 hour'));
    $cancelled = $store->guestReceipt($ref, $firstKey);
    checkReceipt($cancelled['status'] === 'CANCELLED' && $cancelled['updatedAt'] === '2026-11-04T10:00:00.000Z', 'Cancellation supersedes the original confirmation');
    checkReceipt($store->guestReceipt($other['reference'], $otherKey)['status'] === 'CONFIRMED', 'Another guest retains only their own same-day receipt');
} finally {
    unset($store);
    foreach (glob($dir.'/*') as $file) unlink($file);
    rmdir($dir);
}
echo "PASS guest receipt: exact credential pair, isolation, private fields, edit, transfer, reschedule and cancellation\n";
