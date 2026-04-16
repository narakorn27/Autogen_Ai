<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/config.php';
require_once dirname(__DIR__, 2) . '/lib/response_helpers.php';
require_once dirname(__DIR__, 2) . '/lib/youtube_ingest.php';
require_once dirname(__DIR__, 2) . '/lib/audio_prepare.php';
require_once dirname(__DIR__, 2) . '/lib/google_stt.php';
require_once dirname(__DIR__, 2) . '/lib/transcript_normalize.php';

connector_handle_preflight();
connector_require_method('POST');
connector_ensure_storage_dirs();

$payload = connector_read_json_input();
$youtubeUrl = normalize_youtube_url((string) ($payload['youtubeUrl'] ?? ''));
$mode = (string) ($payload['mode'] ?? 'managed_google');
$languageHint = (string) ($payload['languageHint'] ?? 'th-TH');
$byoGoogleApiKey = trim((string) ($payload['byoGoogleApiKey'] ?? ''));

$config = connector_config();
$googleApiKey = $mode === 'byo_google' ? $byoGoogleApiKey : $config['managedGoogleApiKey'];
if ($googleApiKey === '') {
    connector_json_error($mode === 'byo_google' ? 'BYO Google STT key is required.' : 'Managed Google STT key is not configured.', 422);
}

$baseName = connector_unique_basename('youtube');

try {
    $source = extract_youtube_audio($youtubeUrl, $config['tempAudioDir'], $baseName);
    $prepared = normalize_audio_for_stt($source['audioPath'], $config['tempAudioDir'], $baseName . '-stt');
    $transcription = transcribe_with_google_stt($prepared['path'], $googleApiKey, $languageHint);
    $segments = words_to_segments($transcription['words'], $transcription['text']);

    $response = build_transcript_payload([
        'mode' => $mode,
        'sourceType' => 'youtube',
        'sourceTitle' => $source['title'] ?: $youtubeUrl,
        'sourceThumbnail' => $source['thumbnail'] ?? '',
        'sourceDurationSec' => $source['durationSec'] ?? $prepared['durationSec'],
        'detectedLanguage' => $transcription['detectedLanguage'] ?? $languageHint,
        'text' => $transcription['text'],
        'segments' => $segments,
        'warnings' => array_merge($transcription['warnings'] ?? [], $source['title'] ? [] : ['YouTube title metadata was unavailable.']),
    ]);

    persist_transcript_payload($config['transcriptsDir'], $baseName, $response);
    connector_json_response($response);
} catch (Throwable $error) {
    connector_log_error('transcribe_youtube failed', [
        'youtubeUrl' => $youtubeUrl,
        'mode' => $mode,
        'languageHint' => $languageHint,
        'error' => $error->getMessage(),
    ]);
    connector_json_error($error->getMessage(), 500);
}
