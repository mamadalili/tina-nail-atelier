<?php
declare(strict_types=1);

final class BookingFailure extends RuntimeException {
    public function __construct(public string $errorCode, public int $status, string $message, public array $errors = []) { parent::__construct($message); }
}

final class BookingStore {
    private PDO $db;
    private const PERIODS = ['10-12'=>10,'12-14'=>12,'14-16'=>14,'16-18'=>16];

    public function __construct(string $path) {
        $this->db = new PDO('sqlite:'.$path, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $this->db->exec('PRAGMA busy_timeout=10000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS appointments (
            reference TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
            jalali_day TEXT NOT NULL, period TEXT NOT NULL, receipt TEXT NOT NULL, payload TEXT NOT NULL,
            created_at TEXT NOT NULL, UNIQUE(jalali_day, period))');
        $this->db->exec('CREATE TABLE IF NOT EXISTS rate_limits (client TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(client,bucket))');
        $this->db->exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        $secret = $this->db->prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)');
        $secret->execute(['rate_secret',bin2hex(random_bytes(32))]);
        @chmod($path,0600);
    }

    public static function gregorian(string $day): string {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D',$day,$parts)) self::invalid('date','روز معتبر انتخاب کن.');
        [$all,$year,$month,$date]=$parts;
        $anchors=require __DIR__.'/calendar.php';
        if (!isset($anchors[(int)$year]) || (int)$month<1 || (int)$month>12) self::invalid('date','روز معتبر انتخاب کن.');
        [$start,$leap]=$anchors[(int)$year];
        $length=(int)$month<=6?31:((int)$month<=11?30:($leap?30:29));
        if ((int)$date<1 || (int)$date>$length) self::invalid('date','روز معتبر انتخاب کن.');
        $offset=((int)$month<=6?((int)$month-1)*31:186+((int)$month-7)*30)+(int)$date-1;
        return (new DateTimeImmutable($start,new DateTimeZone('Asia/Tehran')))->modify('+'.$offset.' days')->format('Y-m-d');
    }

    private static function invalid(string $field,string $message): never { throw new BookingFailure('VALIDATION',422,$message,[$field=>$message]); }
    private static function textLength(string $text): int { return preg_match_all('/./us',$text); }
    private static function normalized(mixed $input): array {
        if (!is_array($input)) self::invalid('form','اطلاعات درخواست معتبر نیست.');
        foreach(['name','phone','service','manicureType','date','period','note'] as $key) {
            if (!isset($input[$key])) $input[$key]='';
            if (!is_string($input[$key]) || !preg_match('//u',$input[$key])) self::invalid($key,'اطلاعات این قسمت معتبر نیست.');
        }
        $name=trim($input['name']); $note=trim($input['note']);
        if(self::textLength($name)<2 || self::textLength($name)>80 || preg_match('/[\x00-\x1F\x7F]/u',$name)) self::invalid('name','نام و نام خانوادگی معتبر بنویس.');
        $phone=strtr($input['phone'],array_combine(preg_split('//u','۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789')));
        $phone=preg_replace('/[\s()-]/u','',$phone);
        $phone=preg_replace('/^(?:\+98|0098)/','0',$phone);
        if (!preg_match('/^09\d{9}$/D',$phone)) self::invalid('phone','شمارهٔ موبایل معتبر وارد کن.');
        if (!in_array($input['service'],['manicure','pedicure'],true)) self::invalid('service','یک خدمت انتخاب کن.');
        if ($input['service']==='manicure' && !in_array($input['manicureType'],['gel','extensions'],true)) self::invalid('manicureType','ژلیش یا کاشت را انتخاب کن.');
        if (!isset(self::PERIODS[$input['period']])) self::invalid('period','یک بازهٔ دوساعته انتخاب کن.');
        if (self::textLength($note)>500) self::invalid('note','توضیحات را کوتاه‌تر از ۵۰۰ حرف بنویس.');
        if (($input['consent']??false)!==true) self::invalid('consent','رضایت تماس را تأیید کن.');
        self::gregorian($input['date']);
        return ['name'=>$name,'phone'=>$phone,'service'=>$input['service'],'manicureType'=>$input['service']==='manicure'?$input['manicureType']:'','date'=>$input['date'],'period'=>$input['period'],'note'=>$note,'consent'=>true];
    }

    private static function allowedDate(string $day,DateTimeImmutable $now): string {
        $gregorian=self::gregorian($day);
        $today=$now->setTimezone(new DateTimeZone('Asia/Tehran'))->setTime(0,0);
        if ($gregorian<$today->format('Y-m-d') || $gregorian>$today->modify('+90 days')->format('Y-m-d')) self::invalid('date','یک روز از امروز تا سه ماه آینده انتخاب کن.');
        return $gregorian;
    }

    public function availability(string $day,DateTimeImmutable $now): array {
        self::allowedDate($day,$now);
        $query=$this->db->prepare('SELECT period FROM appointments WHERE jalali_day=? ORDER BY period');
        $query->execute([$day]);
        return ['date'=>$day,'taken'=>$query->fetchAll(PDO::FETCH_COLUMN)];
    }

    public function reserve(string $key,mixed $input,string $client,DateTimeImmutable $now): array {
        if (!preg_match('/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iD',$key)) throw new BookingFailure('BAD_KEY',400,'شناسهٔ درخواست معتبر نیست؛ صفحه را دوباره باز کن.');
        $key=strtolower($key);
        $data=self::normalized($input);
        $payload=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $hash=hash('sha256',$payload);
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $query=$this->db->prepare('SELECT payload_hash,receipt FROM appointments WHERE request_key=?'); $query->execute([$key]); $old=$query->fetch(PDO::FETCH_ASSOC);
            if ($old) {
                if (!hash_equals($old['payload_hash'],$hash)) throw new BookingFailure('IDEMPOTENCY_CONFLICT',409,'اطلاعات درخواست تغییر کرده؛ دوباره ثبت کن.');
                $this->db->exec('COMMIT');
                return ['receipt'=>json_decode($old['receipt'],true,512,JSON_THROW_ON_ERROR),'repeated'=>true];
            }
            $gregorian=self::allowedDate($data['date'],$now);
            $start=new DateTimeImmutable($gregorian.' '.self::PERIODS[$data['period']].':00:00',new DateTimeZone('Asia/Tehran'));
            if ($start<$now) self::invalid('period','این بازه شروع شده؛ ساعت دیگری انتخاب کن.');
            $query=$this->db->prepare('SELECT 1 FROM appointments WHERE jalali_day=? AND period=?'); $query->execute([$data['date'],$data['period']]);
            if($query->fetchColumn()) throw new BookingFailure('SLOT_TAKEN',409,'این بازه رزرو شده؛ ساعت دیگری انتخاب کن.',['period'=>'این بازه رزرو شده؛ ساعت دیگری انتخاب کن.']);
            $secret=$this->db->query("SELECT value FROM settings WHERE key='rate_secret'")->fetchColumn();
            $clientHash=hash_hmac('sha256',$client,$secret); $bucket=(int)floor($now->getTimestamp()/3600);
            $query=$this->db->prepare('SELECT count FROM rate_limits WHERE client=? AND bucket=?');$query->execute([$clientHash,$bucket]);
            if((int)$query->fetchColumn()>=8) throw new BookingFailure('RATE_LIMIT',429,'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کن.');
            $query=$this->db->prepare('INSERT INTO rate_limits(client,bucket,count) VALUES (?,?,1) ON CONFLICT(client,bucket) DO UPDATE SET count=count+1'); $query->execute([$clientHash,$bucket]);
            $query=$this->db->prepare('DELETE FROM rate_limits WHERE bucket<?');$query->execute([$bucket-24]);
            $utc=new DateTimeZone('UTC');$iso=fn(DateTimeImmutable $date)=>$date->setTimezone($utc)->format('Y-m-d\TH:i:s.000\Z');
            $receipt=['reference'=>'TN-'.strtoupper(bin2hex(random_bytes(12))),'status'=>'CONFIRMED','name'=>$data['name'],'service'=>$data['service']==='manicure'?'خدمات مانیکور':'خدمات پدیکور','treatment'=>$data['service']==='manicure'?($data['manicureType']==='gel'?'ژلیش':'کاشت'):'','date'=>$data['date'],'period'=>$data['period'],'startsAt'=>$iso($start),'endsAt'=>$iso($start->modify('+2 hours')),'issuedAt'=>$iso($now)];
            $query=$this->db->prepare('INSERT INTO appointments(reference,request_key,payload_hash,jalali_day,period,receipt,payload,created_at) VALUES (?,?,?,?,?,?,?,?)');
            $query->execute([$receipt['reference'],$key,$hash,$data['date'],$data['period'],json_encode($receipt,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$payload,$receipt['issuedAt']]);
            $this->db->exec('COMMIT');
            return ['receipt'=>$receipt,'repeated'=>false];
        } catch(Throwable $error) { $this->db->exec('ROLLBACK');throw $error; }
    }
}
