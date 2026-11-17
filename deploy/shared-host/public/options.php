<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET','HEAD'], true)) {
    header('Allow: GET, HEAD');
    http_response_code(405);
    echo json_encode(['message'=>'این روش درخواست مجاز نیست.'], JSON_UNESCAPED_UNICODE);
    exit;
}
try {
    $runtime = dirname(__DIR__, 3).'/tina-booking-runtime';
    require $runtime.'/BookingStore.php';
    if (!is_dir($runtime.'/data') && !mkdir($runtime.'/data', 0700, true) && !is_dir($runtime.'/data')) throw new RuntimeException('STORAGE_UNAVAILABLE');
    $store = new BookingStore($runtime.'/data/appointments.sqlite');
    echo json_encode($store->bookingOptions(new DateTimeImmutable()), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    http_response_code(503);
    echo json_encode(['message'=>'دریافت وقت‌های آزاد انجام نشد.'], JSON_UNESCAPED_UNICODE);
}
