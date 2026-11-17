<?php
declare(strict_types=1);

final class BookingFailure extends RuntimeException {
    public function __construct(public string $errorCode, public int $status, string $message, public array $errors = [], public array $conflicts = []) { parent::__construct($message); }
}

final class BookingStore {
    public const RELEASE_SOURCE = 'local';
    private PDO $db;
    private const PERIODS = ['10-12'=>10,'12-14'=>12,'14-16'=>14,'16-18'=>16];
    private const STAFF = ['tina'=>'تینا','sonia'=>'سونیا'];
    private const SERVICES = ['manicure'=>'خدمات دست','pedicure'=>'خدمات پا'];
    private const TREATMENTS = [''=>'','gel'=>'ژلیش','extensions'=>'کاشت'];
    private const MAX_DAYS_OFF = 366;

    public function __construct(string $path) {
        $this->db = new PDO('sqlite:'.$path, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $this->db->exec('PRAGMA busy_timeout=10000');
        $this->migrateSchema($path);
        $this->migrateStaff($path);
        // An absent schedule means the original, fully open calendar (version 1).
        $this->db->exec("CREATE TABLE IF NOT EXISTS staff_schedules (staff TEXT PRIMARY KEY CHECK(staff IN ('tina','sonia')), version INTEGER NOT NULL, week TEXT NOT NULL, days_off TEXT NOT NULL)");
        $this->db->exec('CREATE TABLE IF NOT EXISTS rate_limits (client TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(client,bucket))');
        $this->db->exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        $secret = $this->db->prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)');
        $secret->execute(['rate_secret',bin2hex(random_bytes(32))]);
        @chmod($path,0600);
    }

    private function migrateSchema(string $path):void {
        $columns=$this->db->query('PRAGMA table_info(appointments)')->fetchAll(PDO::FETCH_COLUMN,1);
        if(in_array('status',$columns,true))return;
        if($columns){
            $backup=$path.'.before-administration-'.gmdate('YmdHis').'-'.bin2hex(random_bytes(3)).'.sqlite';
            $this->db->exec('VACUUM INTO '.$this->db->quote($backup));
            @chmod($backup,0600);
        }
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            $columns=$this->db->query('PRAGMA table_info(appointments)')->fetchAll(PDO::FETCH_COLUMN,1);
            if(!in_array('status',$columns,true)){
                $this->db->exec("CREATE TABLE appointments_next (
                    reference TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
                    jalali_day TEXT NOT NULL, period TEXT NOT NULL, receipt TEXT NOT NULL, payload TEXT NOT NULL,
                    created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CONFIRMED', version INTEGER NOT NULL DEFAULT 1, updated_at TEXT)");
                if($columns){
                    $this->db->exec('INSERT INTO appointments_next(reference,request_key,payload_hash,jalali_day,period,receipt,payload,created_at) SELECT reference,request_key,payload_hash,jalali_day,period,receipt,payload,created_at FROM appointments');
                    $this->db->exec('DROP TABLE appointments');
                }
                $this->db->exec('ALTER TABLE appointments_next RENAME TO appointments');
                $this->db->exec("CREATE UNIQUE INDEX confirmed_slot ON appointments(jalali_day,period) WHERE status='CONFIRMED'");
                $this->db->exec('CREATE TABLE slot_blocks(jalali_day TEXT NOT NULL,period TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(jalali_day,period))');
                $this->db->exec('CREATE TABLE booking_history(id INTEGER PRIMARY KEY,reference TEXT,action TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL)');
            }
            $this->db->exec('COMMIT');
        }catch(Throwable $error){$this->db->exec('ROLLBACK');throw $error;}
    }

    private static function calendar(): array {
        static $anchors;
        return $anchors ??= require __DIR__.'/calendar.php';
    }

    private static function monthLength(int $year, int $month): int {
        return $month <= 6 ? 31 : ($month < 12 || self::calendar()[$year][1] ? 30 : 29);
    }

    public static function gregorian(string $day): string {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D',$day,$parts)) self::invalid('date','روز معتبر انتخاب کن.');
        [$all,$year,$month,$date]=$parts;
        $anchors=self::calendar();
        if (!isset($anchors[(int)$year]) || (int)$month<1 || (int)$month>12) self::invalid('date','روز معتبر انتخاب کن.');
        [$start]=$anchors[(int)$year];
        $length=self::monthLength((int)$year,(int)$month);
        if ((int)$date<1 || (int)$date>$length) self::invalid('date','روز معتبر انتخاب کن.');
        $offset=((int)$month<=6?((int)$month-1)*31:186+((int)$month-7)*30)+(int)$date-1;
        return (new DateTimeImmutable($start,new DateTimeZone('Asia/Tehran')))->modify('+'.$offset.' days')->format('Y-m-d');
    }

    private function migrateStaff(string $path):void {
        $columns=$this->db->query('PRAGMA table_info(appointments)')->fetchAll(PDO::FETCH_COLUMN,1);
        if(in_array('staff',$columns,true))return;
        $backup=$path.'.before-staff-'.gmdate('YmdHis').'-'.bin2hex(random_bytes(3)).'.sqlite';
        $this->db->exec('VACUUM INTO '.$this->db->quote($backup));@chmod($backup,0600);
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            $columns=$this->db->query('PRAGMA table_info(appointments)')->fetchAll(PDO::FETCH_COLUMN,1);
            if(!in_array('staff',$columns,true)){
                $this->db->exec("ALTER TABLE appointments ADD COLUMN staff TEXT NOT NULL DEFAULT 'tina' CHECK(staff IN ('tina','sonia'))");
                $this->db->exec('DROP INDEX IF EXISTS confirmed_slot');
                $this->db->exec("CREATE UNIQUE INDEX confirmed_slot ON appointments(staff,jalali_day,period) WHERE status='CONFIRMED'");
                $this->db->exec("CREATE TABLE slot_blocks_staff(staff TEXT NOT NULL DEFAULT 'tina' CHECK(staff IN ('tina','sonia')),jalali_day TEXT NOT NULL,period TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(staff,jalali_day,period))");
                $this->db->exec("INSERT INTO slot_blocks_staff(staff,jalali_day,period,created_at) SELECT 'tina',jalali_day,period,created_at FROM slot_blocks");
                $this->db->exec('DROP TABLE slot_blocks');$this->db->exec('ALTER TABLE slot_blocks_staff RENAME TO slot_blocks');
            }
            $this->db->exec('COMMIT');
        }catch(Throwable $error){$this->db->exec('ROLLBACK');throw $error;}
    }

    private static function staff(mixed $value):string {
        if(!is_string($value)||!isset(self::STAFF[$value]))self::invalid('staff','تینا یا سونیا را انتخاب کن.');
        return $value;
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
        if ($name==='') self::invalid('name','نام و نام خانوادگی‌ات را وارد کن.');
        if(self::textLength($name)<2 || self::textLength($name)>80 || preg_match('/[\x00-\x1F\x7F]/u',$name)) self::invalid('name','نام و نام خانوادگی معتبر بنویس.');
        if (trim($input['phone'])==='') self::invalid('phone','شمارهٔ موبایلت را وارد کن.');
        $phone=strtr($input['phone'],array_combine(preg_split('//u','۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789')));
        $phone=preg_replace('/[\s()-]/u','',$phone);
        $phone=preg_replace('/^(?:\+98|0098)/','0',$phone);
        if (!preg_match('/^09\d{9}$/D',$phone)) self::invalid('phone','شمارهٔ موبایل معتبر وارد کن.');
        if (!isset(self::SERVICES[$input['service']])) self::invalid('service','یک خدمت انتخاب کن.');
        $type=$input['service']==='manicure'?$input['manicureType']:'';
        if (!isset(self::TREATMENTS[$type])) self::invalid('manicureType','نوع خدمت معتبر نیست.');
        if (trim($input['date'])==='') self::invalid('date','روز مراجعه را از تقویم انتخاب کن.');
        if (!isset(self::PERIODS[$input['period']])) self::invalid('period','ساعت مراجعه را از بین بازه‌های دوساعته انتخاب کن.');
        if (self::textLength($note)>500) self::invalid('note','توضیحات را کوتاه‌تر از ۵۰۰ حرف بنویس.');
        if (($input['consent']??false)!==true) self::invalid('consent','رضایت تماس را تأیید کن.');
        self::gregorian($input['date']);
        return ['name'=>$name,'phone'=>$phone,'service'=>$input['service'],'manicureType'=>$type,'date'=>$input['date'],'period'=>$input['period'],'note'=>$note,'consent'=>true,'staff'=>self::staff($input['staff']??'tina')];
    }

    private static function allowedDate(string $day,DateTimeImmutable $now): string {
        $gregorian=self::gregorian($day);
        $today=$now->setTimezone(new DateTimeZone('Asia/Tehran'))->setTime(0,0);
        if ($gregorian<$today->format('Y-m-d') || $gregorian>$today->modify('+90 days')->format('Y-m-d')) self::invalid('date','یک روز از امروز تا سه ماه آینده انتخاب کن.');
        return $gregorian;
    }

    private static function slotStart(string $date, string $period): DateTimeImmutable {
        return new DateTimeImmutable($date.' '.self::PERIODS[$period].':00:00', new DateTimeZone('Asia/Tehran'));
    }

    private static function openWeek(): array {
        return array_fill(0, 7, array_keys(self::PERIODS));
    }

    public function schedule(mixed $staff): array {
        self::staff($staff);
        $query = $this->db->prepare('SELECT version,week,days_off FROM staff_schedules WHERE staff=?');
        $query->execute([$staff]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        return [
            'staff'=>$staff, 'version'=>$row ? (int)$row['version'] : 1,
            'week'=>$row ? json_decode($row['week'], true, 8, JSON_THROW_ON_ERROR) : self::openWeek(),
            'daysOff'=>$row ? json_decode($row['days_off'], true, 8, JSON_THROW_ON_ERROR) : [],
        ];
    }

    private static function scheduleInput(array $body, array $previous, DateTimeImmutable $today): array {
        $week = $body['week'] ?? null;
        $daysOff = $body['daysOff'] ?? null;
        if (!is_array($week) || !array_is_list($week) || count($week) !== 7) self::invalid('week', 'ساعت کاری هر هفت روز هفته را انتخاب کن.');
        foreach ($week as &$hours) {
            if (!is_array($hours) || !array_is_list($hours) || count($hours) > count(self::PERIODS)) self::invalid('week', 'بازه‌های ساعت کاری معتبر نیست.');
            $seen = [];
            foreach ($hours as $period) {
                if (!is_string($period) || !isset(self::PERIODS[$period]) || isset($seen[$period])) self::invalid('week', 'بازه‌های ساعت کاری معتبر نیست.');
                $seen[$period] = true;
            }
            $hours = array_keys(array_intersect_key(self::PERIODS, $seen));
        }
        unset($hours);
        if (!is_array($daysOff) || !array_is_list($daysOff) || count($daysOff) > self::MAX_DAYS_OFF) self::invalid('daysOff', 'فهرست روزهای مرخصی معتبر نیست.');
        $seen = [];
        foreach ($daysOff as $day) {
            if (!is_string($day) || isset($seen[$day])) self::invalid('daysOff', 'روز مرخصی معتبر و بدون تکرار انتخاب کن.');
            try { $date = self::gregorian($day); }
            catch (BookingFailure $error) { self::invalid('daysOff', 'تاریخ مرخصی معتبر انتخاب کن.'); }
            if ($date < $today->format('Y-m-d') && !in_array($day, $previous['daysOff'], true)) {
                self::invalid('daysOff', 'برای مرخصی تازه، امروز یا یک روز آینده را انتخاب کن.');
            }
            $seen[$day] = true;
        }
        sort($daysOff, SORT_STRING);
        return ['staff'=>$previous['staff'], 'version'=>$previous['version']+1, 'week'=>$week, 'daysOff'=>$daysOff];
    }

    private static function closedPeriods(array $schedule, string $day, DateTimeImmutable $localDay, bool $applyWeek = true): array {
        if (in_array($day, $schedule['daysOff'], true)) return array_keys(self::PERIODS);
        if (!$applyWeek) return [];
        $weekday = ((int)$localDay->format('w') + 1) % 7; // Saturday is index 0.
        return array_values(array_diff(array_keys(self::PERIODS), $schedule['week'][$weekday]));
    }

    public function saveSchedule(array $body, ?DateTimeImmutable $now = null): array {
        $staff = self::staff($body['staff'] ?? null);
        $version = $body['version'] ?? null;
        if (!is_int($version) || $version < 1) self::invalid('version', 'نسخهٔ برنامهٔ کاری معتبر نیست.');
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $now ??= new DateTimeImmutable();
            $today = $now->setTimezone(new DateTimeZone('Asia/Tehran'))->setTime(0, 0);
            $current = $this->schedule($staff);
            if ($current['version'] !== $version) throw new BookingFailure('STALE_SCHEDULE', 409, 'برنامهٔ کاری تغییر کرده است. آن را تازه کن و دوباره بررسی کن.');
            $next = self::scheduleInput($body, $current, $today);
            $query = $this->db->prepare("SELECT reference,jalali_day AS date,period FROM appointments WHERE staff=? AND status='CONFIRMED' AND jalali_day>=? ORDER BY jalali_day,period");
            $query->execute([$staff, self::jalaliDay($today)]);
            $conflicts = [];
            while ($booking = $query->fetch(PDO::FETCH_ASSOC)) {
                $day = $booking['date']; $period = $booking['period'];
                $start = self::slotStart(self::gregorian($day), $period);
                if ($start > $now && in_array($period, self::closedPeriods($next, $day, $start), true)
                    && !in_array($period, self::closedPeriods($current, $day, $start), true)) $conflicts[] = $booking;
            }
            if ($conflicts) throw new BookingFailure('SCHEDULE_CONFLICT', 409, 'این ساعت‌ها نوبت دارند. ابتدا نوبت‌های زیر را جابه‌جا یا لغو کن.', [], $conflicts);
            $query = $this->db->prepare('INSERT INTO staff_schedules(staff,version,week,days_off) VALUES (?,?,?,?) ON CONFLICT(staff) DO UPDATE SET version=excluded.version,week=excluded.week,days_off=excluded.days_off');
            $query->execute([$staff,$next['version'],json_encode($next['week'], JSON_THROW_ON_ERROR),json_encode($next['daysOff'], JSON_THROW_ON_ERROR)]);
            $this->audit(null, 'SCHEDULE', $next, $now);
            $this->db->exec('COMMIT');
            return $next;
        } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
    }

    public function availability(string $day,DateTimeImmutable $now,string $staff='tina'): array {
        self::staff($staff);
        $date = self::allowedDate($day,$now);
        $query=$this->db->prepare("SELECT period FROM appointments WHERE jalali_day=? AND staff=? AND status='CONFIRMED' UNION SELECT period FROM slot_blocks WHERE jalali_day=? AND staff=? ORDER BY period");
        $query->execute([$day,$staff,$day,$staff]);
        $closed = self::closedPeriods($this->schedule($staff), $day, new DateTimeImmutable($date, new DateTimeZone('Asia/Tehran')));
        $taken = array_merge($query->fetchAll(PDO::FETCH_COLUMN), $closed);
        return ['date'=>$day,'taken'=>array_values(array_intersect(array_keys(self::PERIODS), $taken))];
    }

    private static function jalaliDay(DateTimeImmutable $tehranDay): string {
        $date = $tehranDay->format('Y-m-d');
        $anchors = self::calendar();
        foreach (array_reverse($anchors, true) as $year => [$firstDay, $leap]) {
            if ($date < $firstDay) continue;
            $first = new DateTimeImmutable($firstDay, $tehranDay->getTimezone());
            $offset = (int)$first->diff($tehranDay)->format('%a');
            if ($offset >= ($leap ? 366 : 365)) break;
            $month = $offset < 186 ? 1 + intdiv($offset, 31) : 7 + intdiv($offset - 186, 30);
            $day = $offset < 186 ? 1 + $offset % 31 : 1 + ($offset - 186) % 30;
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
        throw new RuntimeException('CALENDAR_OUT_OF_RANGE');
    }

    public function bookingOptions(DateTimeImmutable $now): array {
        $localDay = $now->setTimezone(new DateTimeZone('Asia/Tehran'))->setTime(0, 0);
        $from = self::jalaliDay($localDay);
        $through = self::jalaliDay($localDay->modify('+90 days'));
        $query = $this->db->prepare("SELECT staff,jalali_day AS date,period FROM appointments
            WHERE status='CONFIRMED' AND staff IN ('tina','sonia') AND jalali_day BETWEEN ? AND ?
            UNION SELECT staff,jalali_day AS date,period FROM slot_blocks
            WHERE staff IN ('tina','sonia') AND jalali_day BETWEEN ? AND ?
            ORDER BY date,period,staff");
        $query->execute([$from, $through, $from, $through]);
        return [
            'asOf' => $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z'),
            'taken' => self::calendarBlocks($query->fetchAll(PDO::FETCH_ASSOC), array_map([$this,'schedule'], array_keys(self::STAFF)), $localDay, $localDay->modify('+90 days'), $localDay, false),
        ];
    }

    private static function calendarBlocks(array $rows, array $schedules, DateTimeImmutable $first, DateTimeImmutable $last, DateTimeImmutable $today, bool $showSource): array {
        $schedules = array_filter($schedules, static fn($schedule) => $schedule['daysOff'] || $schedule['week'] !== self::openWeek());
        if (!$schedules) return $rows;
        $bySlot = [];
        foreach ($rows as $row) $bySlot[$row['date'].' '.$row['period'].' '.$row['staff']] = $row;
        for ($date = $first; $date <= $last; $date = $date->modify('+1 day')) {
            $day = self::jalaliDay($date);
            foreach ($schedules as $schedule) {
                // A recurring rule describes availability going forward; only explicit leave is dated history.
                foreach (self::closedPeriods($schedule, $day, $date, $date >= $today) as $period) {
                    $slot = ['staff'=>$schedule['staff'], 'date'=>$day, 'period'=>$period];
                    if ($showSource) $slot['source'] = 'schedule';
                    $bySlot[$day.' '.$period.' '.$schedule['staff']] = $slot;
                }
            }
        }
        ksort($bySlot, SORT_STRING);
        return array_values($bySlot);
    }

    public function reserve(string $key,mixed $input,string $client,DateTimeImmutable $now): array {
        if (!preg_match('/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iD',$key)) throw new BookingFailure('BAD_KEY',400,'شناسهٔ درخواست معتبر نیست؛ صفحه را دوباره باز کن.');
        $key=strtolower($key);
        $data=self::normalized($input);
        $payload=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $hash=hash('sha256',$payload);
        $legacyData=$data;unset($legacyData['staff']);$legacyHash=hash('sha256',json_encode($legacyData,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $query=$this->db->prepare('SELECT payload_hash,receipt,status,staff FROM appointments WHERE request_key=?'); $query->execute([$key]); $old=$query->fetch(PDO::FETCH_ASSOC);
            if ($old) {
                if (!hash_equals($old['payload_hash'],$hash)&&!($data['staff']==='tina'&&hash_equals($old['payload_hash'],$legacyHash))) throw new BookingFailure('IDEMPOTENCY_CONFLICT',409,'اطلاعات درخواست تغییر کرده؛ دوباره ثبت کن.');
                if($old['status']!=='CONFIRMED')throw new BookingFailure('BOOKING_CANCELLED',409,'این نوبت لغو شده است. برای نوبت تازه دوباره روز و ساعت انتخاب کن.');
                $this->db->exec('COMMIT');
                return ['receipt'=>array_replace(json_decode($old['receipt'],true,512,JSON_THROW_ON_ERROR),['staff'=>$old['staff'],'staffName'=>self::STAFF[$old['staff']]]),'repeated'=>true];
            }
            $gregorian=self::allowedDate($data['date'],$now);
            $start=self::slotStart($gregorian,$data['period']);
            if ($start<$now) self::invalid('period','این بازه شروع شده؛ ساعت دیگری انتخاب کن.');
            $this->assertSlotFree($data['date'],$data['period'],$data['staff']);
            $secret=$this->db->query("SELECT value FROM settings WHERE key='rate_secret'")->fetchColumn();
            $clientHash=hash_hmac('sha256',$client,$secret); $bucket=(int)floor($now->getTimestamp()/3600);
            $query=$this->db->prepare('SELECT count FROM rate_limits WHERE client=? AND bucket=?');$query->execute([$clientHash,$bucket]);
            if((int)$query->fetchColumn()>=8) throw new BookingFailure('RATE_LIMIT',429,'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کن.');
            $query=$this->db->prepare('INSERT INTO rate_limits(client,bucket,count) VALUES (?,?,1) ON CONFLICT(client,bucket) DO UPDATE SET count=count+1'); $query->execute([$clientHash,$bucket]);
            $query=$this->db->prepare('DELETE FROM rate_limits WHERE bucket<?');$query->execute([$bucket-24]);
            $utc=new DateTimeZone('UTC');$iso=fn(DateTimeImmutable $date)=>$date->setTimezone($utc)->format('Y-m-d\TH:i:s.000\Z');
            $receipt=['reference'=>'TN-'.strtoupper(bin2hex(random_bytes(12))),'status'=>'CONFIRMED','name'=>$data['name'],'service'=>self::SERVICES[$data['service']],'treatment'=>self::TREATMENTS[$data['manicureType']],'date'=>$data['date'],'period'=>$data['period'],'startsAt'=>$iso($start),'endsAt'=>$iso($start->modify('+2 hours')),'issuedAt'=>$iso($now)];
            $receipt['staff']=$data['staff'];$receipt['staffName']=self::STAFF[$data['staff']];
            $query=$this->db->prepare('INSERT INTO appointments(reference,request_key,payload_hash,jalali_day,period,receipt,payload,created_at,staff) VALUES (?,?,?,?,?,?,?,?,?)');
            $query->execute([$receipt['reference'],$key,$hash,$data['date'],$data['period'],json_encode($receipt,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$payload,$receipt['issuedAt'],$data['staff']]);
            $this->db->exec('COMMIT');
            return ['receipt'=>$receipt,'repeated'=>false];
        } catch(Throwable $error) { $this->db->exec('ROLLBACK');throw $error; }
    }

    private function assertSlotFree(string $day,string $period,string $staff,string $exclude='',bool $checkSchedule=true):void {
        $q=$this->db->prepare("SELECT 1 FROM appointments WHERE jalali_day=? AND period=? AND staff=? AND status='CONFIRMED' AND reference<>? UNION SELECT 1 FROM slot_blocks WHERE jalali_day=? AND period=? AND staff=? LIMIT 1");
        $q->execute([$day,$period,$staff,$exclude,$day,$period,$staff]);
        $occupied = (bool)$q->fetchColumn();
        if (!$occupied && $checkSchedule) {
            $start = self::slotStart(self::gregorian($day), $period);
            $occupied = in_array($period, self::closedPeriods($this->schedule($staff), $day, $start), true);
        }
        if($occupied)throw new BookingFailure('SLOT_TAKEN',409,'این ساعت در دسترس نیست. ساعت دیگری انتخاب کن.',['period'=>'این ساعت رزرو یا بسته شده است.']);
    }

    private function provedBooking(mixed $reference, mixed $requestKey, bool $includePayload = false): ?array {
        if (!is_string($reference) || !preg_match('/^TN-[A-F0-9]{16,32}$/D', $reference)) return null;
        if (!is_string($requestKey) || !preg_match('/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iD', $requestKey)) return null;
        $fields = 'reference,status,version,receipt,staff,jalali_day,period,created_at,updated_at'.($includePayload ? ',payload' : '');
        $query = $this->db->prepare("SELECT $fields FROM appointments WHERE reference=? AND request_key=? AND status IN ('CONFIRMED','CANCELLED')");
        $query->execute([$reference, strtolower($requestKey)]);
        return $query->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private static function savedReceipt(array $row): array {
        $issued = json_decode($row['receipt'], true, 32, JSON_THROW_ON_ERROR);
        $start = self::slotStart(self::gregorian($row['jalali_day']), $row['period']);
        $utc = new DateTimeZone('UTC');
        $iso = static fn(DateTimeImmutable $time) => $time->setTimezone($utc)->format('Y-m-d\TH:i:s.v\Z');
        return [
            'reference'=>$row['reference'], 'status'=>$row['status'], 'version'=>(int)$row['version'], 'name'=>$issued['name'],
            'service'=>$issued['service'], 'treatment'=>$issued['treatment'] ?? '',
            'staff'=>$row['staff'], 'staffName'=>self::STAFF[$row['staff']],
            'date'=>$row['jalali_day'], 'period'=>$row['period'], 'startsAt'=>$iso($start), 'endsAt'=>$iso($start->modify('+2 hours')),
            'issuedAt'=>$row['created_at'], 'updatedAt'=>$iso(new DateTimeImmutable($row['updated_at'] ?? $row['created_at'])),
        ];
    }

    public function guestReceipt(mixed $reference, mixed $requestKey): ?array {
        $row = $this->provedBooking($reference, $requestKey);
        return $row ? self::savedReceipt($row) : null;
    }

    private static function invalidGuestChange(string $message): never {
        throw new BookingFailure('INVALID_REQUEST', 422, $message);
    }

    public function changeGuestReceipt(array $body, ?DateTimeImmutable $now = null): ?array {
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $now ??= new DateTimeImmutable();
            $row = $this->provedBooking($body['reference'] ?? null, $body['requestKey'] ?? null, true);
            if (!$row) { $this->db->exec('COMMIT'); return null; }
            $action = $body['action'] ?? null;
            $version = $body['version'] ?? null;
            if (!in_array($action, ['cancel','reschedule'], true) || !is_int($version) || $version < 1) self::invalidGuestChange('درخواست تغییر نوبت معتبر نیست.');
            $allowed = ['reference','requestKey','action','version'];
            $cancel = $action === 'cancel';
            if (!$cancel) {
                array_push($allowed, 'date', 'period');
                $day = $body['date'] ?? null;
                $period = $body['period'] ?? null;
                if (!is_string($day) || !is_string($period) || !isset(self::PERIODS[$period])) self::invalidGuestChange('روز و ساعت معتبر انتخاب کن.');
            }
            if (array_diff(array_keys($body), $allowed)) self::invalidGuestChange('فقط روز و ساعت نوبت قابل تغییر است.');
            $currentVersion = (int)$row['version'];
            $alreadyDone = $cancel ? $row['status'] === 'CANCELLED' : $row['status'] === 'CONFIRMED' && $day === $row['jalali_day'] && $period === $row['period'];
            if ($version > $currentVersion || (!$alreadyDone && ($version !== $currentVersion || $row['status'] !== 'CONFIRMED'))) {
                throw new BookingFailure('STALE_BOOKING', 409, 'این نوبت تغییر کرده است. رسید را تازه کن و دوباره بررسی کن.');
            }
            // A lost response can be retried after the slot starts. It must never write a second history entry.
            if ($alreadyDone && ($cancel || $version < $currentVersion)) {
                $receipt = self::savedReceipt($row);
                $this->db->exec('COMMIT'); return $receipt;
            }
            if (self::slotStart(self::gregorian($row['jalali_day']), $row['period']) <= $now) {
                throw new BookingFailure('BOOKING_STARTED', 409, 'زمان این نوبت رسیده و دیگر قابل تغییر نیست.');
            }
            if ($cancel) {
                $this->writeCancellation($row, $now, 'GUEST_CANCEL');
            } elseif (!$alreadyDone) {
                try { $date = self::gregorian($day); }
                catch (BookingFailure $error) { self::invalidGuestChange($error->getMessage()); }
                $start = self::slotStart($date, $period);
                if ($start <= $now) throw new BookingFailure('TARGET_STARTED', 409, 'ساعت انتخابی شروع شده است. یک ساعت دیگر انتخاب کن.');
                try { self::allowedDate($day, $now); }
                catch (BookingFailure $error) { self::invalidGuestChange($error->getMessage()); }
                $this->assertSlotFree($day, $period, $row['staff'], $row['reference']);
                $data = json_decode($row['payload'], true, 32, JSON_THROW_ON_ERROR);
                $data = array_replace($data, ['staff'=>$row['staff'], 'date'=>$day, 'period'=>$period]);
                $issued = json_decode($row['receipt'], true, 32, JSON_THROW_ON_ERROR);
                $this->writeUpdate($row, $data, $issued, $start, $now, 'GUEST_RESCHEDULE');
            }
            $receipt = $alreadyDone ? self::savedReceipt($row) : $this->guestReceipt($row['reference'], $body['requestKey']);
            $this->db->exec('COMMIT');
            return $receipt;
        } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
    }

    private static function adminRecord(array $row):array {
        $data=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);
        return ['reference'=>$row['reference'],'status'=>$row['status'],'version'=>(int)$row['version'],'name'=>$data['name'],'phone'=>$data['phone'],'service'=>$data['service'],'manicureType'=>$data['manicureType']??'','date'=>$row['jalali_day'],'period'=>$row['period'],'note'=>$data['note'],'issuedAt'=>$row['created_at'],'updatedAt'=>$row['updated_at'],'staff'=>$row['staff']];
    }

    public function adminMonth(string $month,string $staff='tina',?DateTimeImmutable $now=null):array {
        self::staff($staff);
        if(!preg_match('/^\d{4}-\d{2}$/D',$month))self::invalid('month','ماه معتبر انتخاب کن.');
        $zone = new DateTimeZone('Asia/Tehran');
        $first = new DateTimeImmutable(self::gregorian($month.'-01'), $zone);
        $today = ($now ?? new DateTimeImmutable())->setTimezone($zone)->setTime(0, 0);
        $last = $first->modify('+'.(self::monthLength((int)substr($month,0,4), (int)substr($month,5,2))-1).' days');
        $q=$this->db->prepare('SELECT * FROM appointments WHERE jalali_day LIKE ? AND staff=? ORDER BY jalali_day,period,created_at');$q->execute([$month.'-%',$staff]);
        $records=array_map([self::class,'adminRecord'],$q->fetchAll(PDO::FETCH_ASSOC));
        $q=$this->db->prepare('SELECT jalali_day AS date,period,staff FROM slot_blocks WHERE jalali_day LIKE ? AND staff=? ORDER BY jalali_day,period');$q->execute([$month.'-%',$staff]);
        return ['month'=>$month,'staff'=>$staff,'appointments'=>$records,'blocks'=>self::calendarBlocks($q->fetchAll(PDO::FETCH_ASSOC), [$this->schedule($staff)], $first, $last, $today, true)];
    }

    public function adminFind(mixed $input): ?array {
        $reference = is_string($input) ? strtoupper(trim($input)) : '';
        if (!preg_match('/^TN-[A-F0-9]{16,32}$/D',$reference)) self::invalid('reference','کد پیگیری کامل روی رسید را وارد کن.');
        $q = $this->db->prepare('SELECT reference,staff,jalali_day AS date,period,status FROM appointments WHERE reference=?');
        $q->execute([$reference]);
        $row = $q->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    private function editableRecord(string $reference,int $version):array {
        $q=$this->db->prepare('SELECT * FROM appointments WHERE reference=?');$q->execute([$reference]);$row=$q->fetch(PDO::FETCH_ASSOC);
        if(!$row)throw new BookingFailure('NOT_FOUND',404,'این نوبت پیدا نشد.');
        if((int)$row['version']!==$version)throw new BookingFailure('STALE_BOOKING',409,'این نوبت تغییر کرده است؛ فهرست را تازه کن و دوباره بررسی کن.');
        if($row['status']!=='CONFIRMED')throw new BookingFailure('BOOKING_CANCELLED',409,'این نوبت قبلاً لغو شده است.');
        return $row;
    }

    private function audit(?string $reference,string $action,array $details,DateTimeImmutable $now):void {
        $q=$this->db->prepare('INSERT INTO booking_history(reference,action,details,created_at) VALUES (?,?,?,?)');
        $q->execute([$reference,$action,json_encode($details,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$now->format(DATE_ATOM)]);
    }

    private function writeUpdate(array $old, array $data, array $receipt, DateTimeImmutable $start, DateTimeImmutable $now, string $action): void {
        $iso = static fn(DateTimeImmutable $time) => $time->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.000\Z');
        $receipt = array_replace($receipt, [
            'name'=>$data['name'], 'date'=>$data['date'], 'period'=>$data['period'], 'startsAt'=>$iso($start), 'endsAt'=>$iso($start->modify('+2 hours')),
            'staff'=>$data['staff'], 'staffName'=>self::STAFF[$data['staff']],
        ]);
        // Keep payload_hash (the original booking request) so reserve retries continue to work after a move.
        $query = $this->db->prepare('UPDATE appointments SET jalali_day=?,period=?,staff=?,payload=?,receipt=?,version=version+1,updated_at=? WHERE reference=?');
        $query->execute([$data['date'],$data['period'],$data['staff'],json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),json_encode($receipt,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$now->format(DATE_ATOM),$old['reference']]);
        $this->audit($old['reference'], $action, ['from'=>[$old['staff'],$old['jalali_day'],$old['period']], 'to'=>[$data['staff'],$data['date'],$data['period']]], $now);
    }

    private function writeCancellation(array $row, DateTimeImmutable $now, string $action): void {
        $query = $this->db->prepare("UPDATE appointments SET status='CANCELLED',version=version+1,updated_at=? WHERE reference=?");
        $query->execute([$now->format(DATE_ATOM), $row['reference']]);
        $this->audit($row['reference'], $action, ['date'=>$row['jalali_day'],'period'=>$row['period']], $now);
    }

    public function adminUpdate(string $reference,int $version,mixed $input,DateTimeImmutable $now):array {
        $data=self::normalized($input);
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            $old=$this->editableRecord($reference,$version);
            $moved=$data['date']!==$old['jalali_day']||$data['period']!==$old['period']||$data['staff']!==$old['staff'];
            $date=$moved?self::allowedDate($data['date'],$now):self::gregorian($data['date']);
            $start=self::slotStart($date,$data['period']);
            if($moved&&$start<$now)self::invalid('period','این ساعت گذشته است؛ ساعت آینده را انتخاب کن.');
            $this->assertSlotFree($data['date'],$data['period'],$data['staff'],$reference,$moved);
            $receipt=json_decode($old['receipt'],true,512,JSON_THROW_ON_ERROR);
            $previous=json_decode($old['payload'],true,512,JSON_THROW_ON_ERROR);
            $sameService=$previous['service']===$data['service'];
            $previousType=$previous['manicureType']??'';
            if($sameService && $data['service']==='manicure' && !array_key_exists('manicureType',$input)) $data['manicureType']=$previousType;
            // A reschedule keeps the wording on an already issued receipt.
            if(!$sameService || !isset($receipt['service'])) $receipt['service']=self::SERVICES[$data['service']];
            if(!$sameService || $previousType!==$data['manicureType'] || !isset($receipt['treatment'])) $receipt['treatment']=self::TREATMENTS[$data['manicureType']];
            $this->writeUpdate($old, $data, $receipt, $start, $now, $moved ? 'RESCHEDULE' : 'EDIT');
            $q=$this->db->prepare('SELECT * FROM appointments WHERE reference=?');$q->execute([$reference]);$result=self::adminRecord($q->fetch(PDO::FETCH_ASSOC));
            $this->db->exec('COMMIT');return $result;
        }catch(Throwable $error){$this->db->exec('ROLLBACK');throw $error;}
    }

    public function adminCancel(string $reference,int $version,DateTimeImmutable $now):void {
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            $old=$this->editableRecord($reference,$version);
            $this->writeCancellation($old, $now, 'CANCEL');
            $this->db->exec('COMMIT');
        }catch(Throwable $error){$this->db->exec('ROLLBACK');throw $error;}
    }

    public function setBlocked(string $day,string $period,bool $blocked,DateTimeImmutable $now,string $staff='tina'):void {
        self::staff($staff);
        if(!isset(self::PERIODS[$period]))self::invalid('period','ساعت معتبر انتخاب کن.');
        if($blocked)self::allowedDate($day,$now);else self::gregorian($day);
        $this->db->exec('BEGIN IMMEDIATE');
        try{
            if($blocked){
                $q=$this->db->prepare("SELECT 1 FROM appointments WHERE jalali_day=? AND period=? AND staff=? AND status='CONFIRMED'");$q->execute([$day,$period,$staff]);
                if($q->fetchColumn())throw new BookingFailure('SLOT_TAKEN',409,'این ساعت نوبت ثبت‌شده دارد؛ ابتدا نوبت را جابه‌جا یا لغو کن.');
                $q=$this->db->prepare('INSERT OR IGNORE INTO slot_blocks(staff,jalali_day,period,created_at) VALUES (?,?,?,?)');$q->execute([$staff,$day,$period,$now->format(DATE_ATOM)]);
            }else{$q=$this->db->prepare('DELETE FROM slot_blocks WHERE jalali_day=? AND period=? AND staff=?');$q->execute([$day,$period,$staff]);}
            $this->audit(null,$blocked?'BLOCK':'REOPEN',['staff'=>$staff,'date'=>$day,'period'=>$period],$now);
            $this->db->exec('COMMIT');
        }catch(Throwable $error){$this->db->exec('ROLLBACK');throw $error;}
    }
}
