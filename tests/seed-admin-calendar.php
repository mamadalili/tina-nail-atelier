<?php
declare(strict_types=1);
$runtime=realpath($argv[1]??'');$allowed=realpath(__DIR__.'/../artifacts');
if(PHP_SAPI!=='cli'||!$runtime||!str_starts_with($runtime,$allowed.DIRECTORY_SEPARATOR.'admin-ui-'))throw new RuntimeException('Use isolated local UI storage only');
require $runtime.'/BookingStore.php';
if(!is_dir($runtime.'/data'))mkdir($runtime.'/data',0700);
file_put_contents($runtime.'/admin-bootstrap.hash',password_hash('Only-local-test-42!',PASSWORD_BCRYPT));
$store=new BookingStore($runtime.'/data/appointments.sqlite');$now=new DateTimeImmutable('now');
$data=['name'=>'مهمان آزمایشی یک','phone'=>'09000000000','service'=>'manicure','manicureType'=>'gel','date'=>$argv[2],'period'=>'12-14','note'=>'نمونهٔ آزمایش محلی؛ نوبت واقعی نیست.','consent'=>true];
$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff101',$data,'fixture',$now);
$store->reserve('70e39a2d-2f0e-4e1f-a4c1-59dc5f6ff102',array_replace($data,['name'=>'مهمان آزمایشی دو','service'=>'pedicure','manicureType'=>'','period'=>'14-16','note'=>'']),'fixture',$now);
$store->setBlocked($argv[2],'16-18',true,$now);
echo "Isolated UI fixture prepared\n";
