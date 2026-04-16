<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/response_helpers.php';

function empty_youtube_feed_xml(): string
{
    return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:media="http://search.yahoo.com/mrss/"
      xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <title>GhostAI Feed Fallback</title>
  <id>ghostai-feed-fallback</id>
  <updated>2026-04-17T00:00:00+00:00</updated>
</feed>
XML;
}

connector_handle_preflight();
connector_require_method('GET');

$channelId = trim((string) ($_GET['channel_id'] ?? 'UCM246zZ4qMNmDw8JOPjFquw'));
if ($channelId === '') {
    connector_json_error('channel_id is required.', 422);
}

if (!function_exists('curl_init')) {
    connector_log_error('youtube_feed cURL unavailable', ['channelId' => $channelId]);
    connector_send_cors_headers();
    http_response_code(200);
    header('Content-Type: application/xml; charset=UTF-8');
    echo empty_youtube_feed_xml();
    exit;
}

$feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' . rawurlencode($channelId);
$ch = curl_init($feedUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
        'Accept: application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'User-Agent: GhostAI-Studio/1.0',
    ],
]);

$body = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($body === false) {
    connector_log_error('youtube_feed request failed', [
        'channelId' => $channelId,
        'feedUrl' => $feedUrl,
        'error' => $error ?: 'Unable to fetch YouTube feed.',
    ]);
    connector_send_cors_headers();
    http_response_code(200);
    header('Content-Type: application/xml; charset=UTF-8');
    echo empty_youtube_feed_xml();
    exit;
}

if ($status >= 400 || trim((string) $body) === '') {
    connector_log_error('youtube_feed unexpected status', [
        'channelId' => $channelId,
        'feedUrl' => $feedUrl,
        'status' => $status,
        'detail' => $error ?: 'YouTube returned an unexpected status.',
    ]);
    connector_send_cors_headers();
    http_response_code(200);
    header('Content-Type: application/xml; charset=UTF-8');
    echo empty_youtube_feed_xml();
    exit;
}

connector_send_cors_headers();
http_response_code(200);
header('Content-Type: application/xml; charset=UTF-8');
echo $body;
exit;
