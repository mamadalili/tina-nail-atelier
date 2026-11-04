<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/BookingStore.php';
if(!method_exists(BookingStore::class,'adminMonth')) { fwrite(STDERR,"FAIL: shared calendar administration is missing\n");exit(1); }
function ok(bool $value,string $message): void { if(!$value) throw new RuntimeException($message); }
function rejected(callable $run,string $code): void { try{$run();}catch(BookingFailure $error){ok($error->errorCode===$code,'Expected '.$code.', got '.$error->errorCode);return;}throw new RuntimeException('Expected '.$code); }
$dir=sys_get_temp_dir().'/tina-admin-test-'.bin2hex(random_bytes(6));mkdir($dir,0700);
$path=$dir.'/appointments.sqlite';
$legacy=new PDO('sqlite:'.$path);
$legacy->exec('CREATE TABLE appointments(reference TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,payload_hash TEXT NOT NULL,jalali_day TEXT NOT NULL,period TEXT NOT NULL,receipt TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(jalali_day,period))');
$data=['name'=>'مهمان آزمایشی','phone'=>'09000000000','service'=>'manicure','manicureType'=>'gel','date'=>'1405-08-16','period'=>'12-14','note'=>'','consent'=>true];
$legacyData=array_replace($data,['name'=>'مهمان قبلی','date'=>'1405-07-10']);
$legacyInsert=$legacy->prepare('INSERT INTO appointments VALUES (?,?,?,?,?,?,?,?)');
$legacyInsert->execute(['TN-AAAAAAAAAAAAAAAA','70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff1da',hash('sha256',json_encode($legacyData,JSON_UNESCAPED_UNICODE)),'1405-07-10','12-14','{}',json_encode($legacyData,JSON_UNESCAPED_UNICODE),'2026-10-01T08:00:00Z']);
$store=new BookingStore($path);$now=new DateTimeImmutable('2026-11-04T08:00:00Z');
ok(count(glob($path.'.before-administration-*.sqlite'))===1,'Migration must create a consistent private backup');
ok($store->adminMonth('1405-07')['appointments'][0]['name']==='مهمان قبلی','Existing guest data must survive migration');
$backupDb=new PDO('sqlite:'.glob($path.'.before-administration-*.sqlite')[0]);
ok((int)$backupDb->query('SELECT count(*) FROM appointments')->fetchColumn()===1,'Backup contains the legacy guest');unset($backupDb);
$key='70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff1db';
$receipt=$store->reserve($key,$data,'local',$now)['receipt'];$ref=$receipt['reference'];
$month=$store->adminMonth('1405-08');
ok(count($month['appointments'])===1,'Legacy schema must migrate and permit booking');
$entry=$month['appointments'][0];ok($entry['phone']==='09000000000' && $entry['version']===1,'Authenticated record fields');
$store->setBlocked('1405-08-16','14-16',true,$now);
ok($store->availability('1405-08-16',$now)['taken']===['12-14','14-16'],'Public availability includes blocked slots');
rejected(fn()=>$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff1dc',array_replace($data,['period'=>'14-16']),'local',$now),'SLOT_TAKEN');
rejected(fn()=>$store->setBlocked('1405-08-16','12-14',true,$now),'SLOT_TAKEN');
rejected(fn()=>$store->adminUpdate($ref,1,array_replace($data,['period'=>'14-16']),$now),'SLOT_TAKEN');
$changed=$store->adminUpdate($ref,1,array_replace($data,['date'=>'1405-08-17','period'=>'16-18','name'=>'نام اصلاح‌شده']),$now);
ok($changed['version']===2 && $changed['reference']===$ref,'Reschedule retains identity and increments version');
ok($store->availability('1405-08-16',$now)['taken']===['14-16'],'Old slot freed after move');
rejected(fn()=>$store->adminCancel($ref,1,$now),'STALE_BOOKING');
$replay=$store->reserve($key,$data,'local',$now);
ok($replay['receipt']['date']==='1405-08-17','Idempotent retry must return current schedule');
$store->adminCancel($ref,2,$now);
ok($store->availability('1405-08-17',$now)['taken']===[],'Cancellation frees slot');
ok($store->adminMonth('1405-08')['appointments'][0]['status']==='CANCELLED','Cancellation retains record');
rejected(fn()=>$store->reserve($key,$data,'local',$now),'BOOKING_CANCELLED');
$store->setBlocked('1405-08-16','14-16',false,$now);
ok($store->availability('1405-08-16',$now)['taken']===[],'Reopen frees slot');
$another=$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff1dd',$data,'local',$now);
ok($another['receipt']['status']==='CONFIRMED','Released slot can be reserved again');
rejected(fn()=>$store->adminUpdate($another['receipt']['reference'],1,array_replace($data,['date'=>'1405-08-12']),$now),'VALIDATION');
rejected(fn()=>$store->adminMonth('1405-99'),'VALIDATION');
$db=new PDO('sqlite:'.$path);
ok((int)$db->query('SELECT count(*) FROM booking_history')->fetchColumn()>=4,'Changes are audited');
$workers=[];
for($i=0;$i<6;$i++){
    $pipes=[];$process=proc_open([PHP_BINARY,'-d','extension_dir='.ini_get('extension_dir'),'-d','extension=pdo_sqlite',__DIR__.'/shared-host-admin-race.php',$path,(string)$i],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $workers[]=[$process,$pipes];
}
foreach($workers as [$process,$pipes]){stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);ok(proc_close($process)===0,'Race worker: '.$error);}
$booked=(int)$db->query("SELECT count(*) FROM appointments WHERE jalali_day='1405-08-22' AND period='16-18' AND status='CONFIRMED'")->fetchColumn();
$blocked=(int)$db->query("SELECT count(*) FROM slot_blocks WHERE jalali_day='1405-08-22' AND period='16-18'")->fetchColumn();
ok($booked+$blocked===1,'Concurrent close and booking cannot both occupy a slot');
unset($store,$legacyInsert,$legacy,$db);
foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);
echo "PASS admin: legacy migration, month view, blocking, moves, collisions, stale edits, cancellation, current receipt retry and history\n";
