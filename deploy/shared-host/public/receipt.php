<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['message'=>'این روش درخواست مجاز نیست.']);
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
$production = $origin === 'https://mrdalili.ir' && $host === 'mrdalili.ir' && ($_SERVER['HTTPS'] ?? '') === 'on';
$local = PHP_SAPI === 'cli-server' && $origin === 'http://'.$host && preg_match('/^127\.0\.0\.1:\d+$/D', $host);
if (!$production && !$local) respond(403, ['message'=>'درخواست از این نشانی مجاز نیست.']);
if (!preg_match('/^application\/json(?:\s*;|$)/i', $_SERVER['CONTENT_TYPE'] ?? '')) respond(415, ['message'=>'فرمت درخواست معتبر نیست.']);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 512) respond(413, ['message'=>'حجم درخواست زیاد است.']);
$raw = file_get_contents('php://input', false, null, 0, 513);
if ($raw === false || strlen($raw) > 512) respond(413, ['message'=>'حجم درخواست زیاد است.']);
try {
    $body = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException $error) {
    respond(400, ['message'=>'اطلاعات درخواست خوانده نشد.']);
}
$missing = ['message'=>'این رسید در دسترس نیست.'];
if (!is_array($body) || !isset($body['reference'], $body['requestKey'])) respond(404, $missing);
try {
    $runtime = dirname(__DIR__, 3).'/tina-booking-runtime';
    $path = $runtime.'/data/appointments.sqlite';
    if (!is_file($path)) throw new RuntimeException('STORAGE_UNAVAILABLE');
    require $runtime.'/BookingStore.php';
    $store = new BookingStore($path);
    $receipt = $store->guestReceipt($body['reference'], $body['requestKey']);
    if ($receipt === null) respond(404, $missing);
    respond(200, ['receipt'=>$receipt]);
} catch (Throwable $error) {
    respond(503, ['message'=>'دریافت وضعیت نوبت فعلاً ممکن نیست. دوباره تلاش کن.']);
}
