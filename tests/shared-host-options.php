<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';

function checkOptions(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
$dir = sys_get_temp_dir().'/tina-options-'.bin2hex(random_bytes(6));
mkdir($dir,0700);
try {
    $store = new BookingStore($dir.'/appointments.sqlite');
    $now = new DateTimeImmutable('2025-03-20T20:29:00Z'); // Last minute of leap Esfand.
    $store->setBlocked('1403-12-29','16-18',true,$now->modify('-1 day'),'tina');
    $store->setBlocked('1403-12-30','14-16',true,$now,'sonia');
    $store->setBlocked('1404-03-28','10-12',true,$now,'tina');
    $store->setBlocked('1404-03-29','10-12',true,$now->modify('+1 day'),'sonia');
    $data = ['name'=>'مهمان آزمایشی','phone'=>'09000000000','service'=>'manicure','date'=>'1404-01-01','period'=>'12-14','note'=>'','consent'=>true,'staff'=>'sonia'];
    $booked = $store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff201',$data,'local-options',$now);
    $expected = [
        ['staff'=>'sonia','date'=>'1403-12-30','period'=>'14-16'],
        ['staff'=>'sonia','date'=>'1404-01-01','period'=>'12-14'],
        ['staff'=>'tina','date'=>'1404-03-28','period'=>'10-12'],
    ];
    $result = $store->bookingOptions($now);
    checkOptions(array_keys($result)===['asOf','taken'],'Public snapshot only exposes its clock and occupied times');
    checkOptions((new DateTimeImmutable($result['asOf']))==$now,'Use the same instant for the horizon and response');
    checkOptions($result['taken']===$expected,'Full inclusive horizon spans Nowruz and combines confirmed bookings with each person’s own closures');
    $store->adminCancel($booked['receipt']['reference'],1,$now);
    $store->setBlocked('1403-12-30','14-16',false,$now,'sonia');
    checkOptions($store->bookingOptions($now)['taken']===[$expected[2]],'Cancellation and reopening immediately remove the occupied times');
    checkOptions($store->bookingOptions($now->modify('+1 minute'))['taken']===[
        $expected[2], ['staff'=>'sonia','date'=>'1404-03-29','period'=>'10-12'],
    ],'Tehran midnight moves the horizon on both ends');
    echo "PASS booking options: private snapshot, closures, cancellation, inclusive horizon and Tehran Nowruz rollover\n";
} finally {
    unset($store);
    foreach (glob($dir.'/*') as $file) unlink($file);
    rmdir($dir);
}
