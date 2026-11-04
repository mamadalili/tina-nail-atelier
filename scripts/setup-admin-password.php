<?php
declare(strict_types=1);
ini_set('display_errors','0');
$host=$_SERVER['HTTP_HOST']??'';
if(PHP_SAPI!=='cli-server'||!preg_match('/^127\.0\.0\.1:\d+$/D',$host)){http_response_code(403);exit;}
$folder=__DIR__.'/../artifacts';
if(!is_dir($folder.'/setup-sessions'))mkdir($folder.'/setup-sessions',0700,true);
session_save_path($folder.'/setup-sessions');session_name('tina_local_setup');
session_start(['use_strict_mode'=>1,'use_only_cookies'=>1,'cookie_httponly'=>true,'cookie_samesite'=>'Strict']);
$_SESSION['csrf']??=bin2hex(random_bytes(32));
header('Cache-Control: no-store');header('X-Frame-Options: DENY');header('Referrer-Policy: same-origin');
$done=is_file($folder.'/admin-bootstrap.hash');$error='';
if($_SERVER['REQUEST_METHOD']==='POST'&&!$done){
    if(($_SERVER['HTTP_ORIGIN']??'')!=='http://'.$host||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf'])){http_response_code(403);exit;}
    $password=$_POST['password']??null;$confirm=$_POST['confirm']??null;
    if(!is_string($password)||!is_string($confirm)||preg_match_all('/./us',$password)<12||strlen($password)>72)$error='رمز را با حداقل ۱۲ نویسه و حداکثر ۷۲ بایت انتخاب کن.';
    elseif(!hash_equals($password,$confirm))$error='تکرار رمز با رمز اول یکسان نیست.';
    else{
        $handle=fopen($folder.'/admin-bootstrap.hash','x');
        if(!$handle)$error='ذخیرهٔ رمز انجام نشد.';
        else{chmod($folder.'/admin-bootstrap.hash',0600);fwrite($handle,password_hash($password,PASSWORD_BCRYPT,['cost'=>12]));fclose($handle);$done=true;}
    }
    unset($password,$confirm,$_POST['password'],$_POST['confirm']);
}
?><!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>تنظیم رمز پنل تینا</title><style>body{margin:0;background:#e9ebe8;color:#173d32;font:17px/1.9 Tahoma,sans-serif;min-height:100vh;display:grid;place-items:center}main{box-sizing:border-box;width:min(92%,480px);padding:32px;background:#f7f8f6;border-radius:18px}h1{font-size:26px}label{display:block;margin-top:20px}input,button{box-sizing:border-box;font:inherit;width:100%;min-height:48px;border-radius:8px}input{padding:8px 12px;border:1px solid #6c8178;background:white}button{background:#75283e;color:white;border:0;margin-top:24px;cursor:pointer}p{color:#40574e}.error{color:#75283e}</style><main><span lang="en" dir="ltr">Tina.</span><h1><?= $done?'رمز پنل آماده شد':'رمز مخصوص پنل تینا' ?></h1><?php if($done):?><p role="status">رمز تعیین شد. می‌توانی به گفتگو برگردی. فقط هش رمز برای راه‌اندازی پنل روی هاست فرستاده می‌شود؛ خود رمز وارد گفتگو یا ریپو نمی‌شود.</p><?php else:?><p>این صفحه فقط روی همین کامپیوتر باز است. رمز را خودت انتخاب کن و نزد خودت نگه دار. بعداً با همین رمز در پنل مدیریت وارد می‌شوی.</p><?php if($error):?><p class="error" role="alert"><?= htmlspecialchars($error,ENT_QUOTES,'UTF-8') ?></p><?php endif;?><form method="post"><input type="hidden" name="csrf" value="<?= htmlspecialchars($_SESSION['csrf'],ENT_QUOTES,'UTF-8') ?>"><label for="password">رمز ورود پنل</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required><label for="confirm">تکرار رمز</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="72" required><button>ذخیرهٔ رمز برای راه‌اندازی پنل</button></form><?php endif;?></main></html>
