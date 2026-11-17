<?php
declare(strict_types=1);
ini_set('display_errors','0');
umask(0077);
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

function metricStatus(int $status): never { http_response_code($status); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST'); metricStatus(405); }
$host = $_SERVER['HTTP_HOST'] ?? '';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$production = ($host === 'mrdalili.ir' && $origin === 'https://mrdalili.ir' && ($_SERVER['HTTPS'] ?? '') === 'on');
$local = PHP_SAPI === 'cli-server' && preg_match('/^127\.0\.0\.1:\d+$/D',$host) && $origin === 'http://'.$host;
if (!$production && !$local) metricStatus(403);
if (!preg_match('/^application\/json(?:\s*;|$)/i',$_SERVER['CONTENT_TYPE'] ?? '')) metricStatus(415);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 256) metricStatus(413);
$raw = file_get_contents('php://input',false,null,0,257);
if ($raw === false || strlen($raw) > 256) metricStatus(413);
try {
    $runtime = dirname(__DIR__,3).'/tina-booking-runtime';
    require $runtime.'/BookingMetrics.php';
    $event = json_decode($raw,true,4,JSON_THROW_ON_ERROR);
    if (!BookingMetrics::validEvent($event)) metricStatus(422);
    $metrics = new BookingMetrics($runtime.'/data/metrics.sqlite');
    metricStatus($metrics->record($event,time()) ? 204 : 429);
} catch (JsonException $error) { metricStatus(400); }
catch (Throwable $error) { metricStatus(503); }
