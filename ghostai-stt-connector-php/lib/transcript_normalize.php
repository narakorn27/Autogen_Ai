<?php
declare(strict_types=1);

function words_to_segments(array $words, string $fallbackText = ''): array
{
    if ($words === []) {
        return $fallbackText !== ''
            ? [[
                'start' => 0,
                'end' => 0,
                'text' => trim($fallbackText),
            ]]
            : [];
    }

    $segments = [];
    $currentWords = [];
    $segmentStart = 0.0;
    $segmentEnd = 0.0;

    foreach ($words as $index => $wordEntry) {
        $word = trim((string) ($wordEntry['word'] ?? ''));
        if ($word === '') {
            continue;
        }

        $start = (float) ($wordEntry['start'] ?? 0);
        $end = (float) ($wordEntry['end'] ?? $start);

        if ($currentWords === []) {
            $segmentStart = $start;
        }

        $currentWords[] = $word;
        $segmentEnd = $end;

        $shouldFlush =
            preg_match('/[.!?…]$/u', $word) === 1 ||
            count($currentWords) >= 18 ||
            (($segmentEnd - $segmentStart) >= 7.0);

        if ($shouldFlush) {
            $segments[] = [
                'start' => round($segmentStart, 3),
                'end' => round(max($segmentEnd, $segmentStart), 3),
                'text' => trim(implode(' ', $currentWords)),
            ];
            $currentWords = [];
        }

        if ($index === array_key_last($words) && $currentWords !== []) {
            $segments[] = [
                'start' => round($segmentStart, 3),
                'end' => round(max($segmentEnd, $segmentStart), 3),
                'text' => trim(implode(' ', $currentWords)),
            ];
        }
    }

    return array_values(array_filter($segments, static fn(array $segment): bool => trim((string) ($segment['text'] ?? '')) !== ''));
}

function build_transcript_payload(array $input): array
{
    return [
        'mode' => (string) ($input['mode'] ?? 'managed_google'),
        'providerLabel' => 'Google Cloud STT',
        'sourceType' => (string) ($input['sourceType'] ?? 'upload'),
        'sourceTitle' => trim((string) ($input['sourceTitle'] ?? '')),
        'sourceThumbnail' => trim((string) ($input['sourceThumbnail'] ?? '')),
        'sourceDurationSec' => isset($input['sourceDurationSec']) ? (float) $input['sourceDurationSec'] : null,
        'detectedLanguage' => trim((string) ($input['detectedLanguage'] ?? '')),
        'text' => trim((string) ($input['text'] ?? '')),
        'segments' => array_values($input['segments'] ?? []),
        'warnings' => array_values($input['warnings'] ?? []),
    ];
}

function persist_transcript_payload(string $transcriptsDir, string $baseName, array $payload): void
{
    if (!is_dir($transcriptsDir)) {
        @mkdir($transcriptsDir, 0775, true);
    }

    $target = rtrim($transcriptsDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $baseName . '.json';
    @file_put_contents($target, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
}
