<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';
$store=new BookingStore($argv[1]);$i=(int)$argv[2];$now=new DateTimeImmutable('2026-11-04T08:00:00Z');
try{
    if($i%2===0){$store->setBlocked('1405-08-22','16-18',true,$now);echo 'BLOCKED';}
    else{$store->reserve(sprintf('80e39a2d-2f0e-4e1f-a4c1-%012d',$i),['name'=>'Race guest','phone'=>'09000000000','service'=>'pedicure','manicureType'=>'','date'=>'1405-08-22','period'=>'16-18','note'=>'','consent'=>true],'race-'.$i,$now);echo 'CONFIRMED';}
}catch(BookingFailure $error){if($error->errorCode!=='SLOT_TAKEN')throw $error;echo 'SLOT_TAKEN';}
