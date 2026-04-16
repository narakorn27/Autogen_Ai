<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/config.php';
require_once dirname(__DIR__, 2) . '/lib/response_helpers.php';
require_once dirname(__DIR__, 2) . '/lib/youtube_ingest.php';

connector_handle_preflight();
connector_require_method('POST');
connector_ensure_storage_dirs();

$payload = connector_read_json_input();
$youtubeUrl = normalize_youtube_url((string) ($payload['youtubeUrl'] ?? ''));
$config = connector_config();
$baseName = connector_unique_basename('extract');

try {
    $source = extract_youtube_audio($youtubeUrl, $config['tempAudioDir'], $baseName);
    connector_json_response([
        'ok' => true,
        'title' => $source['title'] ?: '',
        'thumbnail' => $source['thumbnail'] ?? '',
        'audioPath' => $source['audioPath'],
        'warnings' => [],
    ]);
} catch (Throwable $error) {
    connector_json_error($error->getMessage(), 500, ['warnings' => []]);
}
