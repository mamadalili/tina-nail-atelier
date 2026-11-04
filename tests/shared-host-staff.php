<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';
function staffOk(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
function staffReject(callable $action,string $code):void{try{$action();}catch(BookingFailure $error){staffOk($error->errorCode===$code,'Unexpected error '.$error->errorCode);return;}throw new RuntimeException('Expected '.$code);}
$dir=sys_get_temp_dir().'/tina-staff-test-'.bin2hex(random_bytes(6));mkdir($dir,0700);$path=$dir.'/appointments.sqlite';
$store=new BookingStore($path);$now=new DateTimeImmutable('2026-11-04T08:00:00Z');
$data=['name'=>'مهمان آزمایشی','phone'=>'09000000000','service'=>'manicure','manicureType'=>'gel','date'=>'1405-08-20','period'=>'12-14','note'=>'','consent'=>true];
$one=$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff201',$data,'a',$now);
$two=$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff202',$data+['staff'=>'sonia'],'b',$now);
staffOk(($one['receipt']['staff']??null)==='tina'&&($two['receipt']['staff']??null)==='sonia','Receipt must name its person');
staffOk($two['receipt']['staffName']==='سونیا','Persian staff label');
staffReject(fn()=>$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff203',$data+['staff'=>'sonia'],'c',$now),'SLOT_TAKEN');
$store->setBlocked('1405-08-21','14-16',true,$now,'tina');
staffOk($store->availability('1405-08-21',$now,'sonia')['taken']===[],'Tina closure must not block Sonia');
$store->setBlocked('1405-08-21','14-16',true,$now,'sonia');
$store->setBlocked('1405-08-21','14-16',false,$now,'tina');
staffOk($store->availability('1405-08-21',$now,'sonia')['taken']===['14-16'],'Reopening Tina must not reopen Sonia');
$tina=$store->adminMonth('1405-08','tina');$sonia=$store->adminMonth('1405-08','sonia');
staffOk(count($tina['appointments'])===1&&count($sonia['appointments'])===1,'Manager views must be independent');
staffReject(fn()=>$store->adminUpdate($one['receipt']['reference'],1,$data+['staff'=>'sonia'],$now),'SLOT_TAKEN');
$store->adminCancel($one['receipt']['reference'],1,$now);
staffOk($store->availability('1405-08-20',$now,'tina')['taken']===[],'Cancellation frees only Tina');
staffOk($store->availability('1405-08-20',$now,'sonia')['taken']===['12-14'],'Sonia appointment remains');
$moved=$store->adminUpdate($two['receipt']['reference'],1,$data+['staff'=>'tina'],$now);
staffOk($moved['staff']==='tina','Manager can deliberately reassign to a free person');
staffReject(fn()=>$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff204',$data+['staff'=>'other'],'x',$now),'VALIDATION');
staffReject(fn()=>$store->availability('1405-08-20',$now,'other'),'VALIDATION');
unset($store);foreach(glob($dir.'/*')as$file)unlink($file);rmdir($dir);
echo "PASS staff: simultaneous people, independent closures/cancellation, reassignments, receipt labels and validation\n";
