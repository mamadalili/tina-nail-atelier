<?php
declare(strict_types=1);
ini_set('display_errors','0'); umask(0077);
$folder=__DIR__.'/../artifacts';
function prepareAccounts(string $folder,string $password):void {
    if(str_contains($password,"\0") || preg_match_all('/./us',$password)<5 || strlen($password)>72) throw new RuntimeException('رمز باید حداقل ۵ نویسه و حداکثر ۷۲ بایت باشد.');
    $hashes=[];
    foreach(['tina','sonia'] as $username) $hashes[$username]=password_hash($password,PASSWORD_BCRYPT,['cost'=>12]);
    if(!is_dir($folder)) mkdir($folder,0700,true);
    $path=$folder.'/admin-bootstrap.hash';
    $data=json_encode($hashes,JSON_THROW_ON_ERROR);
    $handle=@fopen($path,'x');
    if(!$handle) throw new RuntimeException('فایل تنظیم رمز از قبل وجود دارد.');
    try {
        if(fwrite($handle,$data)!==strlen($data)) throw new RuntimeException('ذخیرهٔ فایل تنظیم رمز انجام نشد.');
    } catch(Throwable $error) { unlink($path); throw $error; } finally { fclose($handle); }
}
if(PHP_SAPI==='cli') {
    if(($argv[1]??'')!=='--accounts') { fwrite(STDERR,"Usage: supply the shared password on stdin with --accounts\n"); exit(2); }
    try { prepareAccounts($folder,rtrim(stream_get_contents(STDIN),"\r\n")); echo "Prepared private credentials for Tina and Sonia.\n"; }
    catch(Throwable $error) { fwrite(STDERR,$error->getMessage()."\n"); exit(1); }
    exit;
}
$host=$_SERVER['HTTP_HOST']??'';
if(PHP_SAPI!=='cli-server'||!preg_match('/^127\.0\.0\.1:\d+$/D',$host)){http_response_code(403);exit;}
if(!is_dir($folder.'/setup-sessions'))mkdir($folder.'/setup-sessions',0700,true);
session_save_path($folder.'/setup-sessions');session_name('tina_local_setup');
session_start(['use_strict_mode'=>1,'use_only_cookies'=>1,'cookie_httponly'=>true,'cookie_samesite'=>'Strict']);
$_SESSION['csrf']??=bin2hex(random_bytes(32));
header('Cache-Control: no-store');header('X-Frame-Options: DENY');header('Referrer-Policy: same-origin');
$done=is_file($folder.'/admin-bootstrap.hash');$error='';
if($_SERVER['REQUEST_METHOD']==='POST'&&!$done){
    if(($_SERVER['HTTP_ORIGIN']??'')!=='http://'.$host||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf'])){http_response_code(403);exit;}
    $password=$_POST['password']??null;$confirm=$_POST['confirm']??null;
    if(!is_string($password)||!is_string($confirm)||!hash_equals($password,$confirm)) $error='تکرار رمز با رمز اول یکسان نیست.';
    else {
        try { prepareAccounts($folder,$password); $done=true; }
        catch(RuntimeException $exception) { $error=$exception->getMessage(); }
    }
}
?><!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>تنظیم رمز پنل مدیریت</title><style>body{margin:0;background:#e9ebe8;color:#173d32;font:17px/1.9 Tahoma,sans-serif;min-height:100vh;display:grid;place-items:center}main{box-sizing:border-box;width:min(92%,480px);padding:32px;background:#f7f8f6;border-radius:18px}h1{font-size:26px}label{display:block;margin-top:20px}input,button{box-sizing:border-box;font:inherit;width:100%;min-height:48px;border-radius:8px}input{padding:8px 12px;border:1px solid #6c8178;background:white}button{background:#75283e;color:white;border:0;margin-top:24px;cursor:pointer}p{color:#40574e}.error{color:#75283e}</style><main><span lang="en" dir="ltr">Tina.</span><h1><?= $done?'فایل تنظیم رمز آماده است':'رمز ورود تینا و سونیا' ?></h1><?php if(!$done):?><?php if($error):?><p class="error" role="alert"><?=htmlspecialchars($error,ENT_QUOTES,'UTF-8')?></p><?php endif;?><form method="post"><input type="hidden" name="csrf" value="<?= htmlspecialchars($_SESSION['csrf'],ENT_QUOTES,'UTF-8') ?>"><label for="password">رمز مشترک دو حساب</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="5" maxlength="72" required><label for="confirm">تکرار رمز</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="5" maxlength="72" required><button>آماده‌سازی رمز دو حساب</button></form><?php endif;?></main></html>
