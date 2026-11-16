<?php
declare(strict_types=1);
require __DIR__.'/../deploy/shared-host/runtime/AdminAuth.php';
function check(bool $value,string $message):void { if (!$value) throw new RuntimeException($message); }
function accountFile(string $tina,string $sonia):string {
    return json_encode(['tina'=>password_hash($tina,PASSWORD_BCRYPT,['cost'=>4]),'sonia'=>password_hash($sonia,PASSWORD_BCRYPT,['cost'=>4])],JSON_THROW_ON_ERROR);
}
$dir=sys_get_temp_dir().'/tina-auth-test-'.bin2hex(random_bytes(6)); mkdir($dir,0700);
$db=$dir.'/auth.sqlite'; $file=$dir.'/bootstrap.hash';
try {
    $auth=new AdminAuth($db,$file);
    check(!$auth->configured(),'Unconfigured panel must fail closed');
    file_put_contents($file,password_hash('legacy-owner',PASSWORD_BCRYPT,['cost'=>4]));
    $auth=new AdminAuth($db,$file);
    check($auth->configured() && !is_file($file),'Consume the legacy bootstrap');
    $legacy=$auth->verify('tina','legacy-owner','guest',100000);
    check(is_string($legacy),'Keep the original owner account');
    check($auth->verify('sonia','legacy-owner','guest',100001)===null,'Legacy password is only for the original account');
    file_put_contents($file,password_hash('accidental-legacy-replacement',PASSWORD_BCRYPT,['cost'=>4]));
    $auth=new AdminAuth($db,$file);
    check($auth->sessionValid('tina',$legacy),'An initial-only legacy file cannot rotate an existing account');
    $first=accountFile('staff-one','staff-two'); file_put_contents($file,$first);
    $auth=new AdminAuth($db,$file);
    $tina=$auth->verify('tina','staff-one','guest',100010); $sonia=$auth->verify('sonia','staff-two','guest',100010);
    check(!is_file($file) && is_string($tina) && is_string($sonia),'Both named accounts are provisioned together');
    check($auth->sessionValid('sonia',$sonia) && !$auth->sessionValid('tina',$sonia),'Session is bound to its account');
    check(!$auth->sessionValid('tina',$legacy) && $auth->verify('tina','legacy-owner','guest',100011)===null,'Rotation invalidates old credentials and sessions');
    check($auth->verify('sonia','staff-one','guest',100011)===null && $auth->verify('other','staff-one','guest',100011)===null,'Reject mismatched and unknown identities');
    file_put_contents($file,json_encode(['tina'=>password_hash('partial',PASSWORD_DEFAULT)]));
    $auth=new AdminAuth($db,$file); check($auth->sessionValid('tina',$tina) && $auth->sessionValid('sonia',$sonia),'Invalid provision cannot partially change accounts');
    file_put_contents($file,accountFile('shared-test','shared-test')); $auth=new AdminAuth($db,$file);
    file_put_contents($file,$first); $auth=new AdminAuth($db,$file);
    check(is_string($auth->verify('tina','shared-test','guest',100020)) && is_string($auth->verify('sonia','shared-test','guest',100020)),'Both accounts accept the explicitly set shared password after re-extracting an old release');
    for($i=0;$i<5;$i++) check($auth->verify($i%2?'tina':'sonia','wrong','limited',100030+$i)===null,'Reject wrong password');
    try { $auth->verify('tina','shared-test','limited',100036); throw new RuntimeException('Rate limit missing'); }
    catch(AdminAuthFailure $error) { check($error->status===429,'Switching username cannot bypass the login limit'); }
    check(is_string($auth->verify('sonia','shared-test','limited',101000)),'Allow login after throttle window');
    echo "PASS named accounts, upgrade, atomic rotation, archive replay, session revocation and shared throttle\n";
} finally { unset($auth); foreach(glob($dir.'/*') as $path) unlink($path); rmdir($dir); }
