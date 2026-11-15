<?php
declare(strict_types=1);

$runtime = __DIR__ . '/../deploy/shared-host/runtime/BookingStore.php';
if (!is_file($runtime)) { fwrite(STDERR, "FAIL: shared-host persistent booking is not implemented\n"); exit(1); }
require $runtime;

function expect(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function fails(callable $run, string $code): void {
    try { $run(); } catch (BookingFailure $error) { expect($error->errorCode === $code, "Expected $code, got {$error->errorCode}"); return; }
    throw new RuntimeException("Expected $code");
}
function requestData(array $changes = []): array {
    return array_replace(['name'=>'مهمان آزمایشی','phone'=>'۰۹۱۲۳۴۵۶۷۸۹','service'=>'manicure','manicureType'=>'gel','date'=>'1405-08-14','period'=>'12-14','note'=>'','consent'=>true], $changes);
}
$now = new DateTimeImmutable('2026-11-04T08:00:00Z');
$dir = sys_get_temp_dir() . '/tina-booking-test-' . bin2hex(random_bytes(6));
mkdir($dir, 0700);
$dbPath = $dir . '/bookings.sqlite';
$store = new BookingStore($dbPath);
$key = '70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff1db';
$first = $store->reserve($key, requestData(), 'guest-a', $now);
expect($first['receipt']['status'] === 'CONFIRMED', 'Must confirm');
expect($first['receipt']['startsAt'] === '2026-11-05T08:30:00.000Z', 'Must use Tehran time');
expect(preg_match('/^TN-[A-F0-9]{24}$/', $first['receipt']['reference']) === 1, 'Random reference');
expect($first['receipt']['name'] === 'مهمان آزمایشی', 'Receipt guest');
$again = (new BookingStore($dbPath))->reserve($key, requestData(), 'guest-a', $now->modify('+2 days'));
expect($again['repeated'] && $again['receipt'] === $first['receipt'], 'Retry must survive restarts and past slot');
fails(fn()=>$store->reserve($key, requestData(['name'=>'مهمان دیگر']), 'guest-a', $now), 'IDEMPOTENCY_CONFLICT');
fails(fn()=>$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff1dc', requestData(['service'=>'pedicure','manicureType'=>'']), 'guest-b', $now), 'SLOT_TAKEN');
$availability = $store->availability('1405-08-14', $now);
expect($availability === ['date'=>'1405-08-14','taken'=>['12-14']], 'Availability must contain only slot IDs');
foreach ([['date'=>'1405-08-12'], ['date'=>'1405-12-30'], ['date'=>'1406-03-01'], ['consent'=>false], ['phone'=>'123'], ['manicureType'=>''], ['service'=>'other'], ['period'=>'11-13'], ['name'=>['nested']], ['note'=>str_repeat('x',501)]] as $bad) {
    fails(fn()=>$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff1dd', requestData($bad), 'guest-c', $now), 'VALIDATION');
}
fails(fn()=>$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff1de', requestData(['date'=>'1405-08-13','period'=>'10-12']), 'guest-c', $now), 'VALIDATION');
expect(BookingStore::gregorian('1403-12-30') === '2025-03-20', 'Leap Esfand');
expect(BookingStore::gregorian('1404-01-01') === '2025-03-21', 'Nowruz');
fails(fn()=>BookingStore::gregorian('1404-12-30'), 'VALIDATION');
fails(fn()=>$store->reserve('bad', requestData(), 'guest-a', $now), 'BAD_KEY');
for ($i=0;$i<8;$i++) { $slot=['10-12','12-14','14-16','16-18'][$i%4]; $day=$i<4?'1405-08-15':'1405-08-16'; $store->reserve(sprintf('70e39a2d-2f0e-4e1f-a4c1-%012d',$i),requestData(['date'=>$day,'period'=>$slot]),'limited',$now); }
fails(fn()=>$store->reserve('70e39a2d-2f0e-4e1f-a4c1-000000000999', requestData(['date'=>'1405-08-17']), 'limited', $now), 'RATE_LIMIT');

$commands=[];
for($i=0;$i<6;$i++) {
    $cmd=[PHP_BINARY,'-d','extension_dir='.ini_get('extension_dir'),'-d','extension=pdo_sqlite',__DIR__.'/shared-host-race.php',$dbPath,(string)$i];
    $pipes=[]; $process=proc_open($cmd,[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $commands[]=[$process,$pipes];
}
$wins=0;$collisions=0;
foreach($commands as [$process,$pipes]) { $output=stream_get_contents($pipes[1]); $error=stream_get_contents($pipes[2]); fclose($pipes[1]);fclose($pipes[2]); expect(proc_close($process)===0,'Race worker: '.$error); $wins += trim($output)==='CONFIRMED'?1:0; $collisions += trim($output)==='SLOT_TAKEN'?1:0; }
expect($wins===1 && $collisions===5,'Exactly one concurrent booking wins');
echo "PASS: confirmation, durable replay, cross-service conflict, private availability, validation, Tehran/leap dates, rate limit and 6-process race\n";
unset($store);
foreach(glob($dir.'/*') as $file) unlink($file);
rmdir($dir);
