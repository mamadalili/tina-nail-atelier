<?php
declare(strict_types=1);
$source=__DIR__.'/../deploy/shared-host/runtime/AdminAuth.php';
if(!is_file($source)){fwrite(STDERR,"FAIL: administration authentication is missing\n");exit(1);}
require $source;
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
$dir=sys_get_temp_dir().'/tina-auth-test-'.bin2hex(random_bytes(6));mkdir($dir,0700);
$auth=new AdminAuth($dir.'/auth.sqlite',$dir.'/bootstrap.hash');
check(!$auth->configured(),'Must fail closed without an account');
$testPassword='Only-local-test-42!';
file_put_contents($dir.'/bootstrap.hash',password_hash($testPassword,PASSWORD_DEFAULT));
$auth=new AdminAuth($dir.'/auth.sqlite',$dir.'/bootstrap.hash');
check($auth->configured() && !is_file($dir.'/bootstrap.hash'),'Import once and consume bootstrap');
check(!$auth->verify('wrong','guest-a',100000),'Reject incorrect password');
check($auth->verify($testPassword,'guest-a',100001),'Accept correct password');
file_put_contents($dir.'/bootstrap.hash',password_hash('Replace-not-allowed-42!',PASSWORD_DEFAULT));
$auth=new AdminAuth($dir.'/auth.sqlite',$dir.'/bootstrap.hash');
check($auth->verify($testPassword,'guest-a',100002),'Releases must never reset an existing password');
for($i=0;$i<5;$i++)check(!$auth->verify('wrong','limited',100010+$i),'Invalid login');
try{$auth->verify($testPassword,'limited',100016);throw new RuntimeException('Rate limit missing');}catch(AdminAuthFailure $error){check($error->status===429,'Throttle status');}
check($auth->verify($testPassword,'limited',101000),'Allow login after throttle window');
unset($auth);foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);
echo "PASS auth: closed bootstrap, one-time import, password validation, no implicit reset and login throttling\n";
