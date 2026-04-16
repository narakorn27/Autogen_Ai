<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/config.php';
require_once dirname(__DIR__, 2) . '/lib/response_helpers.php';
require_once dirname(__DIR__, 2) . '/lib/upload_ingest.php';
require_once dirname(__DIR__, 2) . '/lib/audio_prepare.php';
require_once dirname(__DIR__, 2) . '/lib/google_stt.php';
require_once dirname(__DIR__, 2) . '/lib/transcript_normalize.php';

connector_handle_preflight();
connector_require_method('POST');
connector_ensure_storage_dirs();

$mode = (string) ($_POST['mode'] ?? 'managed_google');
$languageHint = (string) ($_POST['languageHint'] ?? 'th-TH');
$byoGoogleApiKey = trim((string) ($_POST['byoGoogleApiKey'] ?? ''));

$config = connector_config();
$googleApiKey = $mode === 'byo_google' ? $byoGoogleApiKey : $config['managedGoogleApiKey'];
if ($googleApiKey === '') {
    connector_json_error($mode === 'byo_google' ? 'BYO Google STT key is required.' : 'Managed Google STT key is not configured.', 422);
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    connector_json_error('Upload file is required.', 422);
}

$baseName = connector_unique_basename('upload');

try {
    $uploaded = store_uploaded_media($_FILES['file']);
    $prepared = normalize_audio_for_stt($uploaded['path'], $config['tempAudioDir'], $baseName . '-stt');
    $transcription = transcribe_with_google_stt($prepared['path'], $googleApiKey, $languageHint);
    $segments = words_to_segments($transcription['words'], $transcription['text']);

    $response = build_transcript_payload([
        'mode' => $mode,
        'sourceType' => 'upload',
        'sourceTitle' => $uploaded['originalName'],
        'sourceDurationSec' => $prepared['durationSec'],
        'detectedLanguage' => $transcription['detectedLanguage'] ?? $languageHint,
        'text' => $transcription['text'],
        'segments' => $segments,
        'warnings' => $transcription['warnings'] ?? [],
    ]);

    persist_transcript_payload($config['transcriptsDir'], $baseName, $response);
    connector_json_response($response);
} catch (Throwable $error) {
    connector_json_error($error->getMessage(), 500);
}
