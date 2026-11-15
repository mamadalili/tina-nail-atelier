<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';
try {
    $store=new BookingStore($argv[1]);
    $result=$store->reserve(sprintf('80e39a2d-2f0e-4e1f-a4c1-%012d',(int)$argv[2]),['name'=>'Race guest','phone'=>'09123456789','service'=>'pedicure','manicureType'=>'','date'=>'1405-08-20','period'=>'16-18','note'=>'','consent'=>true],'race-'.$argv[2],new DateTimeImmutable('2026-11-04T08:00:00Z'));
    echo $result['receipt']['status'];
} catch(BookingFailure $error) { echo $error->errorCode; }
