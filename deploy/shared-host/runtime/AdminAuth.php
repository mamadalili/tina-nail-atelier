<?php
declare(strict_types=1);

final class AdminAuthFailure extends RuntimeException {
    public function __construct(public int $status,string $message){parent::__construct($message);}
}

final class AdminAuth {
    private PDO $db;
    public function __construct(string $path,string $bootstrap){
        $this->db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $this->db->exec('PRAGMA busy_timeout=10000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS credentials(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
        $this->db->exec('CREATE TABLE IF NOT EXISTS login_limits(client TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(client,bucket))');
        $q=$this->db->prepare('INSERT OR IGNORE INTO credentials(key,value) VALUES (?,?)');
        $q->execute(['rate_secret',bin2hex(random_bytes(32))]);
        if(is_file($bootstrap)){
            $hash=trim((string)file_get_contents($bootstrap));
            if((password_get_info($hash)['algoName']??'unknown')!=='unknown'){
                $q->execute(['password_hash',$hash]);
                unlink($bootstrap);
            }
        }
        @chmod($path,0600);
    }
    public function configured():bool{return(bool)$this->db->query("SELECT 1 FROM credentials WHERE key='password_hash'")->fetchColumn();}
    public function verify(string $password,string $client,int $now):bool{
        if(!$this->configured())throw new AdminAuthFailure(503,'ورود پنل هنوز راه‌اندازی نشده است.');
        $secret=$this->db->query("SELECT value FROM credentials WHERE key='rate_secret'")->fetchColumn();
        $client=hash_hmac('sha256',$client,$secret);$bucket=(int)floor($now/900);
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            $q=$this->db->prepare('SELECT client,count FROM login_limits WHERE bucket=? AND client IN (?,?)');$q->execute([$bucket,$client,'global']);
            foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row)if((int)$row['count']>=($row['client']==='global'?40:5))throw new AdminAuthFailure(429,'تلاش‌های ورود زیاد است؛ تا ۱۵ دقیقهٔ دیگر دوباره امتحان کن.');
            $hash=$this->db->query("SELECT value FROM credentials WHERE key='password_hash'")->fetchColumn();
            $valid=strlen($password)<=256 && password_verify($password,$hash);
            if(!$valid){
                $q=$this->db->prepare('INSERT INTO login_limits(client,bucket,count) VALUES (?,?,1) ON CONFLICT(client,bucket) DO UPDATE SET count=count+1');
                $q->execute([$client,$bucket]);$q->execute(['global',$bucket]);
            }else{
                $q=$this->db->prepare('DELETE FROM login_limits WHERE client=?');$q->execute([$client]);
            }
            $q=$this->db->prepare('DELETE FROM login_limits WHERE bucket<?');$q->execute([$bucket-4]);
            $this->db->exec('COMMIT');return $valid;
        }catch(Throwable $error){$this->db->exec('ROLLBACK');throw $error;}
    }
}
