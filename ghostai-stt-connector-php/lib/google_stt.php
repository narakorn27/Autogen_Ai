<?php
declare(strict_types=1);

function connector_curl_json_request(string $url, array $payload, int $timeoutSeconds = 180): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('cURL extension is not available.');
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => $timeoutSeconds,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
      throw new RuntimeException($error ?: 'Google STT request failed.');
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        $decoded = [];
    }

    return [$status, $decoded];
}

function connector_curl_get_json(string $url, int $timeoutSeconds = 60): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('cURL extension is not available.');
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeoutSeconds,
    ]);

    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
        throw new RuntimeException($error ?: 'Google STT polling failed.');
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        $decoded = [];
    }

    return [$status, $decoded];
}

function parse_google_duration_seconds($value): float
{
    $raw = trim((string) $value);
    if ($raw === '') {
        return 0.0;
    }

    $raw = rtrim($raw, 's');
    return round((float) $raw, 3);
}

function google_words_from_response(array $payload): array
{
    $words = [];
    $results = $payload['results'] ?? [];
    if (!is_array($results)) {
        return [];
    }

    foreach ($results as $result) {
        if (!is_array($result)) {
            continue;
        }
        $alternatives = $result['alternatives'] ?? [];
        if (!is_array($alternatives) || empty($alternatives[0]) || !is_array($alternatives[0])) {
            continue;
        }

        $wordEntries = $alternatives[0]['words'] ?? [];
        if (!is_array($wordEntries)) {
            continue;
        }

        foreach ($wordEntries as $item) {
            if (!is_array($item)) {
                continue;
            }
            $word = trim((string) ($item['word'] ?? ''));
            if ($word === '') {
                continue;
            }

            $words[] = [
                'word' => $word,
                'start' => parse_google_duration_seconds($item['startTime'] ?? 0),
                'end' => parse_google_duration_seconds($item['endTime'] ?? 0),
            ];
        }
    }

    return $words;
}

function google_transcript_text(array $payload): string
{
    $parts = [];
    $results = $payload['results'] ?? [];
    if (!is_array($results)) {
        return '';
    }

    foreach ($results as $result) {
        if (!is_array($result)) {
            continue;
        }
        $alternatives = $result['alternatives'] ?? [];
        if (!is_array($alternatives) || empty($alternatives[0]) || !is_array($alternatives[0])) {
            continue;
        }
        $text = trim((string) ($alternatives[0]['transcript'] ?? ''));
        if ($text !== '') {
            $parts[] = $text;
        }
    }

    return trim(implode("\n", $parts));
}

function google_stt_request_payload(string $audioContentBase64, string $languageHint = 'th-TH'): array
{
    $languageCode = $languageHint === 'auto' ? 'th-TH' : $languageHint;
    $alternativeLanguageCodes = $languageCode === 'th-TH' ? ['en-US'] : ['th-TH'];

    return [
        'config' => [
            'encoding' => 'MP3',
            'sampleRateHertz' => 16000,
            'languageCode' => $languageCode,
            'alternativeLanguageCodes' => $alternativeLanguageCodes,
            'enableWordTimeOffsets' => true,
            'enableAutomaticPunctuation' => true,
            'maxAlternatives' => 1,
            'model' => 'latest_long',
            'speechContexts' => [
                [
                    'phrases' => [
                        'Minecraft',
                        'PVP',
                        'Marco',
                        'Doctor Donut',
                        'Reborn',
                        'Activity',
                        'มาริโอ้',
                        'มาโล่',
                        'ม้าโลก',
                        'ปลอมตัว',
                        'ยูทูปเบอร์',
                        'โปรแกรมโกง',
                        'ช่วยเล็ง',
                        'ขยับเมาส์',
                    ],
                    'boost' => 8.0,
                ],
            ],
        ],
        'audio' => [
            'content' => $audioContentBase64,
        ],
    ];
}

function google_shift_words(array $words, float $offsetSeconds): array
{
    if ($offsetSeconds <= 0) {
        return $words;
    }

    return array_map(static function (array $item) use ($offsetSeconds): array {
        return [
            'word' => $item['word'],
            'start' => round(((float) $item['start']) + $offsetSeconds, 3),
            'end' => round(((float) $item['end']) + $offsetSeconds, 3),
        ];
    }, $words);
}

function google_normalize_merge_text(string $text): string
{
    return trim(preg_replace('/\s+/u', ' ', $text) ?? '');
}

function google_merge_chunk_text(string $currentText, string $nextText): string
{
    $currentText = google_normalize_merge_text($currentText);
    $nextText = google_normalize_merge_text($nextText);

    if ($currentText === '') return $nextText;
    if ($nextText === '') return $currentText;
    if ($currentText === $nextText) return $currentText;

    $currentWords = preg_split('/\s+/u', $currentText) ?: [];
    $nextWords = preg_split('/\s+/u', $nextText) ?: [];
    $maxOverlap = min(20, count($currentWords), count($nextWords));

    for ($size = $maxOverlap; $size >= 3; $size--) {
        $currentTail = implode(' ', array_slice($currentWords, -$size));
        $nextHead = implode(' ', array_slice($nextWords, 0, $size));
        if ($currentTail !== '' && $currentTail === $nextHead) {
            $remaining = implode(' ', array_slice($nextWords, $size));
            return trim($currentText . ' ' . $remaining);
        }
    }

    return trim($currentText . ' ' . $nextText);
}

function google_dedupe_overlapped_words(array $words, float $minGapSeconds = 0.15): array
{
    $deduped = [];

    foreach ($words as $item) {
        $word = trim((string) ($item['word'] ?? ''));
        $start = (float) ($item['start'] ?? 0.0);
        $end = (float) ($item['end'] ?? $start);

        $last = $deduped[count($deduped) - 1] ?? null;
        if (is_array($last)) {
            $lastWord = trim((string) ($last['word'] ?? ''));
            $lastStart = (float) ($last['start'] ?? 0.0);
            $normalizeCase = static function (string $value): string {
                return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
            };
            $sameWord = $lastWord !== '' && $normalizeCase($lastWord) === $normalizeCase($word);
            $nearOverlap = abs($start - $lastStart) <= $minGapSeconds;

            if ($sameWord && $nearOverlap) {
                continue;
            }
        }

        $deduped[] = [
            'word' => $word,
            'start' => round($start, 3),
            'end' => round($end, 3),
        ];
    }

    return $deduped;
}

function transcribe_google_stt_inline_chunk(string $audioPath, string $apiKey, string $languageHint = 'th-TH', float $offsetSeconds = 0.0): array
{
    if (!is_file($audioPath)) {
        throw new RuntimeException('Prepared audio file not found.');
    }

    if ($apiKey === '') {
        throw new RuntimeException('Google Cloud STT API key is missing.');
    }

    $audioBytes = file_get_contents($audioPath);
    if ($audioBytes === false) {
        throw new RuntimeException('Unable to read prepared audio file.');
    }

    $languageCode = $languageHint === 'auto' ? 'th-TH' : $languageHint;
    $url = 'https://speech.googleapis.com/v1p1beta1/speech:recognize?key=' . rawurlencode($apiKey);

    [$status, $response] = connector_curl_json_request($url, google_stt_request_payload(base64_encode($audioBytes), $languageHint), 180);

    if ($status >= 400) {
        $message = trim((string) ($response['error']['message'] ?? 'Google STT request failed.'));
        throw new RuntimeException($message ?: 'Google STT request failed.');
    }

    $words = google_shift_words(google_words_from_response($response), $offsetSeconds);
    $text = google_transcript_text($response);

    if ($text === '' && $words !== []) {
        $text = implode(' ', array_map(static fn(array $item): string => $item['word'], $words));
    }

    return [
        'text' => trim($text),
        'words' => $words,
        'detectedLanguage' => $languageCode,
        'warnings' => [],
    ];
}

function transcribe_with_google_stt(string $audioPath, string $apiKey, string $languageHint = 'th-TH'): array
{
    $durationSec = function_exists('probe_audio_duration') ? (probe_audio_duration($audioPath) ?? 0.0) : 0.0;
    if ($durationSec <= 0 && function_exists('estimate_audio_duration_from_file_size')) {
        $durationSec = estimate_audio_duration_from_file_size($audioPath, 64000) ?? 0.0;
    }
    $shouldChunk = $durationSec > 45;

    if (!$shouldChunk) {
        try {
            return transcribe_google_stt_inline_chunk($audioPath, $apiKey, $languageHint, 0.0);
        } catch (RuntimeException $error) {
            $normalizedMessage = strtolower($error->getMessage());
            $isInlineTooLong =
                str_contains($normalizedMessage, 'inline audio exceeds duration limit') ||
                str_contains($normalizedMessage, 'sync input too long') ||
                (str_contains($normalizedMessage, 'longrunningrecognize') && str_contains($normalizedMessage, 'uri'));

            if (!$isInlineTooLong) {
                throw $error;
            }
            $shouldChunk = true;
        }
    }

    if (!function_exists('split_audio_for_stt_chunks')) {
        throw new RuntimeException('Audio chunking helpers are unavailable.');
    }

    $chunkBaseName = pathinfo($audioPath, PATHINFO_FILENAME) . '-chunk';
    $chunks = split_audio_for_stt_chunks($audioPath, dirname($audioPath), $chunkBaseName, 25, 3.0);
    if (function_exists('connector_log_error')) {
        connector_log_error('google_stt chunking enabled', [
            'audioPath' => $audioPath,
            'durationSec' => $durationSec,
            'chunkCount' => count($chunks),
        ]);
    }

    $allWords = [];
    $mergedText = '';
    $warnings = ['Audio was split into smaller chunks before sending to Google STT.'];
    $detectedLanguage = $languageHint === 'auto' ? 'th-TH' : $languageHint;

    foreach ($chunks as $chunk) {
        $offset = max(0.0, (float) ($chunk['startOffsetSec'] ?? 0.0));
        $result = transcribe_google_stt_inline_chunk($chunk['path'], $apiKey, $languageHint, $offset);
        if ($result['text'] !== '') {
            $mergedText = google_merge_chunk_text($mergedText, $result['text']);
        }
        if (!empty($result['words'])) {
            $allWords = array_merge($allWords, $result['words']);
        }
        if (!empty($result['detectedLanguage'])) {
            $detectedLanguage = $result['detectedLanguage'];
        }
    }

    $allWords = google_dedupe_overlapped_words($allWords);
    if ($mergedText === '' && $allWords !== []) {
        $mergedText = implode(' ', array_map(static fn(array $item): string => (string) $item['word'], $allWords));
    }

    return [
        'text' => trim($mergedText),
        'words' => $allWords,
        'detectedLanguage' => $detectedLanguage,
        'warnings' => $warnings,
    ];
}

function test_google_stt_api_key(string $apiKey): array
{
    if ($apiKey === '') {
        throw new RuntimeException('Google STT API key is missing.');
    }

    $url = 'https://speech.googleapis.com/v1p1beta1/speech:recognize?key=' . rawurlencode($apiKey);
    [$status, $response] = connector_curl_json_request($url, [
        'config' => [
            'encoding' => 'MP3',
            'sampleRateHertz' => 16000,
            'languageCode' => 'th-TH',
        ],
        'audio' => [
            'content' => '',
        ],
    ], 60);

    if ($status >= 400) {
        $message = trim((string) ($response['error']['message'] ?? 'Google STT key test failed.'));
        $normalized = strtolower($message);
        $isAuthFailure =
            str_contains($normalized, 'api key not valid') ||
            str_contains($normalized, 'permission denied') ||
            str_contains($normalized, 'forbidden') ||
            str_contains($normalized, 'has not been used') ||
            str_contains($normalized, 'not enabled') ||
            str_contains($normalized, 'request had insufficient authentication scopes');

        if ($isAuthFailure) {
            throw new RuntimeException($message ?: 'Google STT key is invalid or API access is not enabled.');
        }

        return [
            'ok' => true,
            'message' => 'เชื่อมต่อ Google STT ได้แล้ว คีย์ถูกยอมรับโดยระบบ',
            'detail' => $message ?: 'Google STT accepted the key.',
        ];
    }

    return [
        'ok' => true,
        'message' => 'เชื่อมต่อ Google STT สำเร็จ',
        'detail' => 'Google STT returned a successful response.',
    ];
}
