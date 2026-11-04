<?php
declare(strict_types=1);
ini_set('display_errors','0');umask(0077);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');header('X-Robots-Tag: noindex, nofollow');header('X-Frame-Options: DENY');
function adminRespond(int $status,array $body):never{http_response_code($status);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
try{
    $host=$_SERVER['HTTP_HOST']??'';
    $local=PHP_SAPI==='cli-server'&&preg_match('/^127\.0\.0\.1:\d+$/D',$host);
    $secure=($_SERVER['HTTPS']??'')==='on';
    if(!$local&&(!$secure||$host!=='mrdalili.ir'))adminRespond(403,['message'=>'پنل فقط از نشانی امن سایت باز می‌شود.']);
    $runtime=dirname(__DIR__,2).'/tina-booking-runtime';
    require $runtime.'/BookingStore.php';require $runtime.'/AdminAuth.php';
    if(!is_dir($runtime.'/data/sessions')&&!mkdir($runtime.'/data/sessions',0700,true)&&!is_dir($runtime.'/data/sessions'))throw new RuntimeException('SESSION_STORAGE');
    session_save_path($runtime.'/data/sessions');session_name('tina_administrator');
    session_start(['use_strict_mode'=>1,'use_only_cookies'=>1,'cookie_path'=>'/tina-administrator/','cookie_secure'=>!$local,'cookie_httponly'=>true,'cookie_samesite'=>'Strict','gc_maxlifetime'=>28800]);
    $now=time();
    if(isset($_SESSION['started'])&&($now-$_SESSION['started']>28800||$now-($_SESSION['seen']??0)>3600)){$_SESSION=[];session_regenerate_id(true);}
    $_SESSION['csrf']??=bin2hex(random_bytes(32));
    $auth=new AdminAuth($runtime.'/data/admin.sqlite',$runtime.'/admin-bootstrap.hash');
    $action=$_GET['action']??'status';
    if(!is_string($action))adminRespond(400,['message'=>'درخواست معتبر نیست.']);
    $logged=($_SESSION['authenticated']??false)===true;
    if($logged)$_SESSION['seen']=$now;
    if($_SERVER['REQUEST_METHOD']==='GET'){
        if($action==='status')adminRespond(200,['authenticated'=>$logged,'configured'=>$auth->configured(),'csrf'=>$_SESSION['csrf'],'now'=>gmdate('Y-m-d\TH:i:s\Z')]);
        if(!$logged)adminRespond(401,['code'=>'LOGIN_REQUIRED','message'=>'برای دیدن نوبت‌ها وارد پنل شو.']);
        if($action!=='month')adminRespond(404,['message'=>'این بخش پیدا نشد.']);
        $month=$_GET['month']??'';if(!is_string($month))adminRespond(400,['message'=>'ماه معتبر انتخاب کن.']);
        $store=new BookingStore($runtime.'/data/appointments.sqlite');
        adminRespond(200,$store->adminMonth($month));
    }
    if($_SERVER['REQUEST_METHOD']!=='POST'){header('Allow: GET, POST');adminRespond(405,['message'=>'این روش درخواست مجاز نیست.']);}
    $expected=$local?'http://'.$host:'https://mrdalili.ir';
    if(($_SERVER['HTTP_ORIGIN']??'')!==$expected)adminRespond(403,['message'=>'نشانی درخواست مجاز نیست.']);
    $csrf=$_SERVER['HTTP_X_CSRF_TOKEN']??'';
    if(!$csrf||!hash_equals($_SESSION['csrf'],$csrf))adminRespond(403,['code'=>'CSRF_INVALID','message'=>'صفحه را تازه کن و دوباره تلاش کن.']);
    if(!preg_match('/^application\/json(?:\s*;|$)/i',$_SERVER['CONTENT_TYPE']??''))adminRespond(415,['message'=>'فرمت درخواست معتبر نیست.']);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>8192)adminRespond(413,['message'=>'حجم درخواست زیاد است.']);
    $raw=file_get_contents('php://input',false,null,0,8193);
    if($raw===false||strlen($raw)>8192)adminRespond(413,['message'=>'حجم درخواست زیاد است.']);
    try{$body=json_decode($raw,true,32,JSON_THROW_ON_ERROR);}catch(JsonException $error){adminRespond(400,['message'=>'درخواست خوانده نشد.']);}
    if(!is_array($body))adminRespond(400,['message'=>'درخواست معتبر نیست.']);
    if($action==='login'){
        if(!is_string($body['password']??null))adminRespond(422,['message'=>'رمز ورود را بنویس.']);
        if(!$auth->verify($body['password'],$_SERVER['REMOTE_ADDR']??'unknown',$now))adminRespond(401,['message'=>'رمز ورود درست نیست.']);
        session_regenerate_id(true);
        $_SESSION=['authenticated'=>true,'started'=>$now,'seen'=>$now,'csrf'=>bin2hex(random_bytes(32))];
        adminRespond(200,['authenticated'=>true,'csrf'=>$_SESSION['csrf']]);
    }
    if(!$logged)adminRespond(401,['code'=>'LOGIN_REQUIRED','message'=>'برای ادامه وارد پنل شو.']);
    if($action==='logout'){
        $_SESSION=[];session_destroy();
        setcookie(session_name(),'', ['expires'=>1,'path'=>'/tina-administrator/','secure'=>!$local,'httponly'=>true,'samesite'=>'Strict']);
        adminRespond(200,['authenticated'=>false]);
    }
    $store=new BookingStore($runtime.'/data/appointments.sqlite');$clock=new DateTimeImmutable('now',new DateTimeZone('Asia/Tehran'));
    if($action==='block'){
        if(!is_string($body['date']??null)||!is_string($body['period']??null)||!is_bool($body['blocked']??null))adminRespond(422,['message'=>'روز و ساعت معتبر انتخاب کن.']);
        $store->setBlocked($body['date'],$body['period'],$body['blocked'],$clock);adminRespond(200,['ok'=>true]);
    }
    if(!in_array($action,['update','cancel'],true))adminRespond(404,['message'=>'این بخش پیدا نشد.']);
    if(!is_string($body['reference']??null)||!preg_match('/^TN-[A-F0-9]{16,32}$/D',$body['reference'])||!is_int($body['version']??null)||$body['version']<1)adminRespond(422,['message'=>'شناسهٔ نوبت معتبر نیست.']);
    if($action==='cancel'){$store->adminCancel($body['reference'],$body['version'],$clock);adminRespond(200,['ok'=>true]);}
    $record=$store->adminUpdate($body['reference'],$body['version'],$body['data']??null,$clock);adminRespond(200,['appointment'=>$record]);
}catch(BookingFailure $error){adminRespond($error->status,['code'=>$error->errorCode,'message'=>$error->getMessage()]+($error->errors?['errors'=>$error->errors]:[]));}
catch(AdminAuthFailure $error){adminRespond($error->status,['message'=>$error->getMessage()]);}
catch(Throwable $error){adminRespond(503,['message'=>'ارتباط با پنل برقرار نشد؛ کمی بعد دوباره تلاش کن.']);}
