<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/config.php';
require_once dirname(__DIR__, 2) . '/lib/response_helpers.php';

connector_handle_preflight();
connector_require_method('GET');
connector_ensure_storage_dirs();

$config = connector_config();
$ffmpegReady = connector_find_binary($config['ffmpegBinary']) !== null;
$ytDlpReady = connector_find_binary($config['ytDlpBinary']) !== null;

connector_json_response([
    'ok' => true,
    'connector' => 'ghostai-stt-connector-php',
    'phpVersion' => PHP_VERSION,
    'ffmpegReady' => $ffmpegReady,
    'ytDlpReady' => $ytDlpReady,
    'tempWritable' => connector_is_writable_dir($config['tempAudioDir']),
    'uploadWritable' => connector_is_writable_dir($config['uploadsDir']),
    'message' => $ffmpegReady ? 'Connector online.' : 'Connector online, but ffmpeg is missing.',
]);
