<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/response_helpers.php';
require_once dirname(__DIR__, 2) . '/lib/google_stt.php';

connector_handle_preflight();
connector_require_method('POST');

$payload = connector_read_json_input();
$apiKey = trim((string) ($payload['apiKey'] ?? ''));

if ($apiKey === '') {
    connector_json_error('กรุณากรอก Google STT API key ก่อนทดสอบ', 422);
}

try {
    $result = test_google_stt_api_key($apiKey);
    connector_json_response($result);
} catch (Throwable $error) {
    connector_json_error($error->getMessage(), 422);
}
