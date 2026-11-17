<?php
declare(strict_types=1);

final class PortfolioFailure extends RuntimeException {
    public function __construct(public readonly int $status, string $message) { parent::__construct($message); }
}

final class ServicePortfolio {
    public const REQUEST_LIMIT = 1001000;
    private const IMAGE_LIMIT = 750000;
    private const SIDE_LIMIT = 1440;
    private const PHOTO_LIMIT = 3;
    private const STAFF = ['tina', 'sonia'];
    private const SERVICES = ['manicure', 'pedicure'];
    private const OPTIONS = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5,
    ];

    private static function reader(string $path): ?PDO {
        if (!is_file($path)) return null;
        $db = new PDO('sqlite:'.$path, null, null, self::OPTIONS + [PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY]);
        // A simultaneous first upload can have opened the file before initializing its tables.
        return $db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='photos'")->fetchColumn() ? $db : null;
    }

    public static function catalogue(string $path): array {
        $db = self::reader($path);
        if (!$db) return ['photos' => [], 'tariffs' => []];
        $photos = $db->query('SELECT id, staff, service, width, height FROM photos ORDER BY rowid')->fetchAll();
        $tariffs = $db->query('SELECT staff, service, minimum, maximum FROM tariffs ORDER BY staff, service')->fetchAll();
        return ['photos' => $photos, 'tariffs' => $tariffs];
    }

    public static function photo(string $path, mixed $id): ?string {
        if (!is_string($id) || !preg_match('/^[a-f0-9]{64}$/D', $id)) return null;
        $db = self::reader($path);
        if (!$db) return null;
        $query = $db->prepare('SELECT jpeg FROM photos WHERE id=?');
        $query->execute([$id]);
        $jpeg = $query->fetchColumn();
        return is_string($jpeg) ? $jpeg : null;
    }

    private static function writer(string $path): PDO {
        $db = new PDO('sqlite:'.$path, null, null, self::OPTIONS);
        $db->exec('CREATE TABLE IF NOT EXISTS tariffs (
            staff TEXT NOT NULL, service TEXT NOT NULL, minimum INTEGER NOT NULL, maximum INTEGER,
            PRIMARY KEY(staff, service))');
        $db->exec('CREATE TABLE IF NOT EXISTS photos (
            id TEXT PRIMARY KEY, staff TEXT NOT NULL, service TEXT NOT NULL,
            width INTEGER NOT NULL, height INTEGER NOT NULL, jpeg BLOB NOT NULL)');
        return $db;
    }

    private static function checkFields(array $body, array $expected): void {
        if (count($body) !== count($expected) || array_diff($expected, array_keys($body))) {
            throw new PortfolioFailure(422, 'اطلاعات ارسالی معتبر نیست.');
        }
    }

    public static function save(string $path, string $staff, array $body): array {
        $service = $body['service'] ?? null;
        if (!in_array($staff, self::STAFF, true) || !in_array($service, self::SERVICES, true)) {
            throw new PortfolioFailure(422, 'فرد یا خدمت انتخاب‌شده معتبر نیست.');
        }
        // Attribute the change to the authenticated session and reject an editor from an older login.
        if (($body['staff'] ?? null) !== $staff) throw new PortfolioFailure(409, 'حساب پنل عوض شده است. صفحه را تازه کن و دوباره تلاش کن.');
        unset($body['staff']);
        $type = $body['type'] ?? null;
        if (!is_string($type)) throw new PortfolioFailure(422, 'عملیات درخواست‌شده معتبر نیست.');
        switch ($type) {
            case 'tariff':
                self::checkFields($body, ['type', 'service', 'minimum', 'maximum']);
                self::setTariff($path, $staff, $service, $body['minimum'], $body['maximum']);
                break;
            case 'photo':
                self::checkFields($body, ['type', 'service', 'jpeg']);
                self::addPhoto($path, $staff, $service, $body['jpeg']);
                break;
            case 'remove':
                self::checkFields($body, ['type', 'service', 'id']);
                if (!is_string($body['id']) || !preg_match('/^[a-f0-9]{64}$/D', $body['id'])) {
                    throw new PortfolioFailure(422, 'شناسهٔ عکس معتبر نیست.');
                }
                $delete = self::writer($path)->prepare('DELETE FROM photos WHERE staff=? AND service=? AND id=?');
                $delete->execute([$staff, $service, $body['id']]);
                if (!$delete->rowCount()) throw new PortfolioFailure(404, 'عکس در نمونه‌کارهای این خدمت پیدا نشد.');
                break;
            default:
                throw new PortfolioFailure(422, 'عملیات درخواست‌شده معتبر نیست.');
        }
        return self::catalogue($path);
    }

    private static function setTariff(string $path, string $staff, string $service, mixed $minimum, mixed $maximum): void {
        if ($minimum === null && $maximum === null) {
            self::writer($path)->prepare('DELETE FROM tariffs WHERE staff=? AND service=?')->execute([$staff, $service]);
            return;
        }
        if (!is_int($minimum) || $minimum < 1 || $minimum > 999999999 ||
            ($maximum !== null && (!is_int($maximum) || $maximum < $minimum || $maximum > 999999999))) {
            throw new PortfolioFailure(422, 'تعرفه را به تومان وارد کن. سقف باید برابر یا بیشتر از حداقل باشد.');
        }
        $query = self::writer($path)->prepare('INSERT INTO tariffs(staff,service,minimum,maximum) VALUES (?,?,?,?)
            ON CONFLICT(staff,service) DO UPDATE SET minimum=excluded.minimum,maximum=excluded.maximum');
        $query->execute([$staff, $service, $minimum, $maximum]);
    }

    private static function cleanJpeg(mixed $encoded): array {
        if (!is_string($encoded) || strlen($encoded) > self::IMAGE_LIMIT * 4 / 3) {
            throw new PortfolioFailure(413, 'حجم عکس زیاد است.');
        }
        $original = base64_decode($encoded, true);
        $size = $original === false || $original === '' ? false : @getimagesizefromstring($original);
        if (!$size || $size[2] !== IMAGETYPE_JPEG || min($size[0], $size[1]) < 1 || max($size[0], $size[1]) > self::SIDE_LIMIT) {
            throw new PortfolioFailure(422, 'عکس JPEG معتبر با ضلع حداکثر ۱۴۴۰ پیکسل لازم است.');
        }
        if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
            throw new PortfolioFailure(503, 'پردازش عکس روی میزبان در دسترس نیست.');
        }
        $pixels = @imagecreatefromstring($original);
        if (!$pixels || imagesx($pixels) !== $size[0] || imagesy($pixels) !== $size[1]) {
            throw new PortfolioFailure(422, 'عکس باز نشد. فایل دیگری انتخاب کن.');
        }
        // Only the re-encoded pixels are ever persisted or served. Camera metadata,
        // thumbnails, filenames, comments and appended data never enter storage.
        ob_start();
        try {
            $written = imagejpeg($pixels, null, 82);
            $jpeg = ob_get_contents();
        } finally {
            ob_end_clean();
        }
        if (!$written || !is_string($jpeg) || $jpeg === '') throw new RuntimeException('IMAGE_ENCODING_FAILED');
        if (strlen($jpeg) > self::IMAGE_LIMIT) throw new PortfolioFailure(413, 'حجم عکس زیاد است.');
        return [$jpeg, $size[0], $size[1]];
    }

    private static function addPhoto(string $path, string $staff, string $service, mixed $encoded): void {
        [$jpeg, $width, $height] = self::cleanJpeg($encoded);
        $id = hash('sha256', $staff.'|'.$service.'|'.$jpeg);
        $db = self::writer($path);
        $db->exec('BEGIN IMMEDIATE');
        try {
            $query = $db->prepare('SELECT id FROM photos WHERE staff=? AND service=?');
            $query->execute([$staff, $service]);
            $ids = $query->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array($id, $ids, true)) {
                if (count($ids) >= self::PHOTO_LIMIT) throw new PortfolioFailure(409, 'برای افزودن عکس تازه، یکی از سه نمونه‌کار این خدمت را بردار.');
                $insert = $db->prepare('INSERT INTO photos(id,staff,service,width,height,jpeg) VALUES (?,?,?,?,?,?)');
                $insert->bindValue(1, $id);
                $insert->bindValue(2, $staff);
                $insert->bindValue(3, $service);
                $insert->bindValue(4, $width, PDO::PARAM_INT);
                $insert->bindValue(5, $height, PDO::PARAM_INT);
                $insert->bindValue(6, $jpeg, PDO::PARAM_LOB);
                $insert->execute();
            }
            $db->exec('COMMIT');
        } catch (Throwable $error) {
            $db->exec('ROLLBACK');
            throw $error;
        }
    }
}
