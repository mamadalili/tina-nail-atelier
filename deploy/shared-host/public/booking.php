<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

function respond(int $status,array $body): never { http_response_code($status);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit; }

try {
    $runtime=dirname(__DIR__,3).'/tina-booking-runtime';
    require $runtime.'/BookingStore.php';
    if (!is_dir($runtime.'/data') && !mkdir($runtime.'/data',0700,true) && !is_dir($runtime.'/data')) throw new RuntimeException('STORAGE_UNAVAILABLE');
    $store=new BookingStore($runtime.'/data/appointments.sqlite');
    $now=new DateTimeImmutable('now',new DateTimeZone('Asia/Tehran'));
    if ($_SERVER['REQUEST_METHOD']==='GET') {
        if (($_GET['action']??'')==='health') respond(200,['enabled'=>true,'notifications'=>false]);
        $date=$_GET['date']??'';
        if(!is_string($date)) respond(400,['message'=>'روز معتبر انتخاب کن.']);
        $staff=$_GET['staff']??'tina';if(!is_string($staff))respond(400,['message'=>'فرد معتبر انتخاب کن.']);
        respond(200,$store->availability($date,$now,$staff));
    }
    if ($_SERVER['REQUEST_METHOD']!=='POST') { header('Allow: GET, POST');respond(405,['message'=>'این روش درخواست مجاز نیست.']); }
    $origin=$_SERVER['HTTP_ORIGIN']??'';
    $host=$_SERVER['HTTP_HOST']??'';
    $production=$origin==='https://mrdalili.ir' && $host==='mrdalili.ir' && ($_SERVER['HTTPS']??'')==='on';
    $local=PHP_SAPI==='cli-server' && $origin==='http://'.$host && preg_match('/^127\.0\.0\.1:\d+$/D',$host);
    if (!$production && !$local) respond(403,['message'=>'درخواست از این نشانی مجاز نیست.']);
    if (!preg_match('/^application\/json(?:\s*;|$)/i',$_SERVER['CONTENT_TYPE']??'')) respond(415,['message'=>'فرمت درخواست معتبر نیست.']);
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>8192) respond(413,['message'=>'حجم درخواست زیاد است.']);
    $raw=file_get_contents('php://input',false,null,0,8193);
    if ($raw===false || strlen($raw)>8192) respond(413,['message'=>'حجم درخواست زیاد است.']);
    try { $body=json_decode($raw,true,32,JSON_THROW_ON_ERROR); } catch(JsonException $error) { respond(400,['message'=>'اطلاعات درخواست خوانده نشد.']); }
    $result=$store->reserve($_SERVER['HTTP_IDEMPOTENCY_KEY']??'',$body,$_SERVER['REMOTE_ADDR']??'unknown',$now);
    respond($result['repeated']?200:201,['receipt'=>$result['receipt']]);
} catch(BookingFailure $error) { respond($error->status,['code'=>$error->errorCode,'message'=>$error->getMessage()]+($error->errors?['errors'=>$error->errors]:[])); }
catch(Throwable $error) { respond(503,['message'=>'ثبت نوبت فعلاً انجام نشد. دوباره تلاش کن یا با تینا تماس بگیر.']); }
