<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header("Content-Security-Policy: default-src 'none'; sandbox");

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) {
    header('Allow: GET, HEAD');
    http_response_code(405);
    exit;
}
try {
    $runtime = dirname(__DIR__, 3).'/tina-booking-runtime';
    require $runtime.'/ServicePortfolio.php';
    $path = $runtime.'/data/portfolio.sqlite';
    if (array_key_exists('photo', $_GET)) {
        $jpeg = ServicePortfolio::photo($path, $_GET['photo']);
        if ($jpeg === null) { http_response_code(404); exit; }
        header('Content-Type: image/jpeg');
        header('Content-Disposition: inline; filename="portfolio.jpg"');
        header('Content-Length: '.strlen($jpeg));
        if ($_SERVER['REQUEST_METHOD'] === 'GET') echo $jpeg;
    } else {
        $catalogue = ServicePortfolio::catalogue($path);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') echo json_encode($catalogue, JSON_THROW_ON_ERROR);
    }
} catch (Throwable $error) {
    http_response_code(503);
}
