<?php
declare(strict_types=1);

final class AdminAuthFailure extends RuntimeException {
    public function __construct(public int $status,string $message){parent::__construct($message);}
}

final class AdminAuth {
    // Keep Tina's original key so existing installations retain their owner login.
    private const PASSWORD_KEYS = ['tina'=>'password_hash', 'sonia'=>'password_hash:sonia'];
    private PDO $db;

    public function __construct(string $path,string $bootstrap){
        $this->db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $this->db->exec('PRAGMA busy_timeout=10000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS credentials(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
        $this->db->exec('CREATE TABLE IF NOT EXISTS login_limits(client TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(client,bucket))');
        $q=$this->db->prepare('INSERT OR IGNORE INTO credentials(key,value) VALUES (?,?)');
        $q->execute(['rate_secret',bin2hex(random_bytes(32))]);
        if(is_file($bootstrap)) $this->importBootstrap($bootstrap);
        @chmod($path,0600);
    }

    private static function namedHashes(string $contents):?array {
        $accounts=json_decode($contents,true);
        if (!is_array($accounts) || count($accounts)!==count(self::PASSWORD_KEYS)) return null;
        $hashes=[];
        foreach(self::PASSWORD_KEYS as $username=>$key) {
            $hash=$accounts[$username]??null;
            if (!is_string($hash) || !preg_match('~^\$2[aby]\$(?:0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$~D',$hash)) return null;
            $hashes[$key]=$hash;
        }
        return $hashes;
    }

    private function importBootstrap(string $path):void {
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            // Another request may have consumed the file while this request waited for the lock.
            $raw=is_file($path) ? @file_get_contents($path) : false;
            $contents=$raw===false ? '' : trim($raw);
            $insert=$this->db->prepare('INSERT OR IGNORE INTO credentials(key,value) VALUES (?,?)');
            $consumed=false;
            if ((password_get_info($contents)['algoName']??'unknown')!=='unknown') {
                $insert->execute([self::PASSWORD_KEYS['tina'],$contents]);
                $consumed=true;
            } elseif (($hashes=self::namedHashes($contents))!==null) {
                // Re-extracting an old archive must never undo a newer password change.
                $insert->execute(['import:'.hash('sha256',implode('|',$hashes)),'1']);
                if ($insert->rowCount()>0) {
                    $save=$this->db->prepare('INSERT INTO credentials(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
                    foreach($hashes as $key=>$hash) $save->execute([$key,$hash]);
                }
                $consumed=true;
            }
            $this->db->exec('COMMIT');
        } catch(Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
        if ($consumed && @file_get_contents($path)===$raw) @unlink($path);
    }

    public function configured():bool {
        return (bool)$this->db->query("SELECT 1 FROM credentials WHERE key='password_hash'")->fetchColumn();
    }

    private function passwordHash(string $username):?string {
        if (!isset(self::PASSWORD_KEYS[$username])) return null;
        $q=$this->db->prepare('SELECT value FROM credentials WHERE key=?');
        $q->execute([self::PASSWORD_KEYS[$username]]);
        $hash=$q->fetchColumn();
        return is_string($hash) ? $hash : null;
    }

    public function sessionValid(string $username,string $version):bool {
        $hash=$this->passwordHash($username);
        return $hash!==null && hash_equals(hash('sha256',$username.'|'.$hash),$version);
    }

    public function verify(string $username,string $password,string $client,int $now):?string {
        if(!$this->configured())throw new AdminAuthFailure(503,'ورود پنل هنوز راه‌اندازی نشده است.');
        $secret=$this->db->query("SELECT value FROM credentials WHERE key='rate_secret'")->fetchColumn();
        $client=hash_hmac('sha256',$client,$secret);$bucket=(int)floor($now/900);
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            $q=$this->db->prepare('SELECT client,count FROM login_limits WHERE bucket=? AND client IN (?,?)');$q->execute([$bucket,$client,'global']);
            foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row)if((int)$row['count']>=($row['client']==='global'?40:5))throw new AdminAuthFailure(429,'تلاش‌های ورود زیاد است؛ تا ۱۵ دقیقهٔ دیگر دوباره امتحان کن.');
            $hash=$this->passwordHash($username);
            $valid=$hash!==null && strlen($password)<=256 && !str_contains($password,"\0") && password_verify($password,$hash);
            if(!$valid){
                $q=$this->db->prepare('INSERT INTO login_limits(client,bucket,count) VALUES (?,?,1) ON CONFLICT(client,bucket) DO UPDATE SET count=count+1');
                $q->execute([$client,$bucket]);$q->execute(['global',$bucket]);
            }else{
                $q=$this->db->prepare('DELETE FROM login_limits WHERE client=?');$q->execute([$client]);
            }
            $q=$this->db->prepare('DELETE FROM login_limits WHERE bucket<?');$q->execute([$bucket-4]);
            $this->db->exec('COMMIT');
            return $valid ? hash('sha256',$username.'|'.$hash) : null;
        }catch(Throwable $error){$this->db->exec('ROLLBACK');throw $error;}
    }
}
