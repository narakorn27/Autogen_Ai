<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function find_extracted_audio_path(string $outputDir, string $baseName): ?string
{
    $outputDir = rtrim($outputDir, DIRECTORY_SEPARATOR);
    $expectedPath = $outputDir . DIRECTORY_SEPARATOR . $baseName . '.mp3';
    if (is_file($expectedPath) && filesize($expectedPath) > 0) {
        return $expectedPath;
    }

    $pattern = $outputDir . DIRECTORY_SEPARATOR . $baseName . '*';
    $matches = glob($pattern) ?: [];
    $candidates = array_values(array_filter($matches, static function (string $path): bool {
        return is_file($path) && filesize($path) > 0 && preg_match('/\.mp3$/i', $path) === 1;
    }));

    if ($candidates === []) {
        return null;
    }

    usort($candidates, static function (string $a, string $b): int {
        return filemtime($b) <=> filemtime($a);
    });

    return $candidates[0] ?? null;
}

function normalize_youtube_url(string $url): string
{
    $url = trim($url);
    if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
        throw new RuntimeException('Please provide a valid YouTube URL.');
    }

    return $url;
}

function fetch_youtube_metadata(string $youtubeUrl): array
{
    if (!connector_exec_available()) {
        return [];
    }

    $config = connector_config();
    $ytDlpBinary = connector_find_binary($config['ytDlpBinary']);
    if ($ytDlpBinary === null) {
        return [];
    }

    $command = sprintf(
        '%s --dump-single-json --skip-download --no-warnings --no-playlist %s 2>&1',
        connector_shell_value($ytDlpBinary),
        connector_shell_value($youtubeUrl)
    );
    $output = [];
    $exitCode = 1;
    @exec($command, $output, $exitCode);
    if ($exitCode !== 0) {
        return [];
    }

    $json = implode("\n", $output);
    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        return [];
    }

    return [
        'title' => trim((string) ($decoded['title'] ?? '')),
        'thumbnail' => trim((string) ($decoded['thumbnail'] ?? '')),
        'durationSec' => isset($decoded['duration']) ? (float) $decoded['duration'] : null,
    ];
}

function extract_youtube_audio(string $youtubeUrl, string $outputDir, string $baseName): array
{
    if (!connector_exec_available()) {
        throw new RuntimeException('PHP exec() is disabled on this host.');
    }

    $config = connector_config();
    $ytDlpBinary = connector_find_binary($config['ytDlpBinary']);
    if ($ytDlpBinary === null) {
        throw new RuntimeException('yt-dlp binary is not available.');
    }

    $ffmpegBinary = connector_find_binary($config['ffmpegBinary']);
    if ($ffmpegBinary === null) {
        throw new RuntimeException('ffmpeg binary is not available.');
    }

    if (!is_dir($outputDir)) {
        @mkdir($outputDir, 0775, true);
    }

    $template = rtrim($outputDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $baseName . '.%(ext)s';
    $shellTemplate = connector_windows_safe_template($template);
    $command = sprintf(
        '%s --no-playlist --extract-audio --audio-format mp3 --audio-quality 0 --ffmpeg-location %s -o %s %s 2>&1',
        connector_shell_value($ytDlpBinary),
        connector_shell_value($ffmpegBinary),
        connector_shell_value($shellTemplate),
        connector_shell_value($youtubeUrl)
    );

    $output = [];
    $exitCode = 1;
    @exec($command, $output, $exitCode);

    $audioPath = find_extracted_audio_path($outputDir, $baseName);
    if ($exitCode !== 0 || $audioPath === null || !is_file($audioPath) || filesize($audioPath) <= 0) {
        $detail = trim(implode("\n", array_slice($output, -8)));
        $message = 'Unable to extract audio from YouTube URL.';
        if ($detail !== '') {
            $message .= ' yt-dlp says: ' . preg_replace('/\s+/', ' ', $detail);
        }
        throw new RuntimeException($message);
    }

    $metadata = fetch_youtube_metadata($youtubeUrl);

    return [
        'audioPath' => $audioPath,
        'title' => $metadata['title'] ?? '',
        'thumbnail' => $metadata['thumbnail'] ?? '',
        'durationSec' => $metadata['durationSec'] ?? null,
    ];
}
