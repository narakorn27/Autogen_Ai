<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

const GHOSTAI_STT_AUDIO_BITRATE_BPS = 96000;
const GHOSTAI_STT_AUDIO_BITRATE_LABEL = '96k';

function build_audio_chunk_error(string $message, array $output = []): RuntimeException
{
    $detail = trim(implode("\n", array_slice($output, -12)));
    if ($detail !== '') {
        $message .= ' ffmpeg says: ' . preg_replace('/\s+/', ' ', $detail);
    }

    return new RuntimeException($message);
}

function normalize_audio_for_stt(string $inputPath, string $outputDir, string $baseName): array
{
    if (!is_file($inputPath)) {
        throw new RuntimeException('Input media file not found.');
    }

    if (!connector_exec_available()) {
        throw new RuntimeException('PHP exec() is disabled on this host.');
    }

    $config = connector_config();
    $ffmpegBinary = connector_find_binary($config['ffmpegBinary']);
    if ($ffmpegBinary === null) {
        throw new RuntimeException('ffmpeg binary is not available.');
    }

    if (!is_dir($outputDir)) {
        @mkdir($outputDir, 0775, true);
    }

    $outputPath = rtrim($outputDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $baseName . '.mp3';
    $command = sprintf(
        '%s -y -i %s -vn -ac 1 -ar 16000 -b:a %s %s 2>&1',
        connector_shell_value($ffmpegBinary),
        connector_shell_value($inputPath),
        GHOSTAI_STT_AUDIO_BITRATE_LABEL,
        connector_shell_value($outputPath)
    );

    $output = [];
    $exitCode = 1;
    @exec($command, $output, $exitCode);

    if ($exitCode !== 0 || !is_file($outputPath) || filesize($outputPath) <= 0) {
        throw new RuntimeException('Unable to normalize audio with ffmpeg.');
    }

    return [
        'path' => $outputPath,
        'durationSec' => probe_audio_duration($outputPath) ?? estimate_audio_duration_from_file_size($outputPath, GHOSTAI_STT_AUDIO_BITRATE_BPS),
    ];
}

function estimate_audio_duration_from_file_size(string $audioPath, int $bitrateBps = GHOSTAI_STT_AUDIO_BITRATE_BPS): ?float
{
    if (!is_file($audioPath)) {
        return null;
    }

    $sizeBytes = filesize($audioPath);
    if ($sizeBytes === false || $sizeBytes <= 0 || $bitrateBps <= 0) {
        return null;
    }

    $seconds = ($sizeBytes * 8) / $bitrateBps;
    return round(max(0.0, $seconds), 3);
}

function split_audio_for_stt_chunks(string $inputPath, string $outputDir, string $baseName, int $chunkSeconds = 30, float $overlapSeconds = 2.0): array
{
    if (!is_file($inputPath)) {
        throw new RuntimeException('Input media file not found.');
    }

    if (!connector_exec_available()) {
        throw new RuntimeException('PHP exec() is disabled on this host.');
    }

    $config = connector_config();
    $ffmpegBinary = connector_find_binary($config['ffmpegBinary']);
    if ($ffmpegBinary === null) {
        throw new RuntimeException('ffmpeg binary is not available.');
    }

    if (!is_dir($outputDir)) {
        @mkdir($outputDir, 0775, true);
    }

    $safeChunkSeconds = max(10, min(30, $chunkSeconds));
    $safeOverlapSeconds = max(0.0, min(5.0, $overlapSeconds));
    $stepSeconds = max(5.0, $safeChunkSeconds - $safeOverlapSeconds);
    $durationSec = probe_audio_duration($inputPath) ?? estimate_audio_duration_from_file_size($inputPath, GHOSTAI_STT_AUDIO_BITRATE_BPS);

    if ($durationSec !== null && $durationSec > 0) {
        $chunks = [];
        $index = 0;

        for ($offset = 0.0; $offset < $durationSec; $offset += $stepSeconds) {
            $remaining = $durationSec - $offset;
            $currentChunkLength = min($safeChunkSeconds, max(1.0, $remaining));
            $outputPath = rtrim($outputDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . sprintf('%s-%03d.mp3', $baseName, $index);

            $command = sprintf(
                '%s -y -ss %s -t %s -i %s -vn -ac 1 -ar 16000 -b:a %s %s 2>&1',
                connector_shell_value($ffmpegBinary),
                connector_shell_value((string) round($offset, 3)),
                connector_shell_value((string) round($currentChunkLength, 3)),
                connector_shell_value($inputPath),
                GHOSTAI_STT_AUDIO_BITRATE_LABEL,
                connector_shell_value($outputPath)
            );

            $output = [];
            $exitCode = 1;
            @exec($command, $output, $exitCode);

            if ($exitCode !== 0 || !is_file($outputPath) || filesize($outputPath) <= 0) {
                throw build_audio_chunk_error('Unable to split audio into STT chunks.', $output);
            }

            $chunks[] = [
                'path' => $outputPath,
                'durationSec' => probe_audio_duration($outputPath) ?? estimate_audio_duration_from_file_size($outputPath, GHOSTAI_STT_AUDIO_BITRATE_BPS) ?? $currentChunkLength,
                'startOffsetSec' => round($offset, 3),
            ];
            $index++;

            if (($offset + $currentChunkLength) >= $durationSec) {
                break;
            }
        }

        if ($chunks !== []) {
            return $chunks;
        }
    }
    throw new RuntimeException('Unable to detect audio duration for chunking.');
}

function probe_audio_duration(string $audioPath): ?float
{
    if (!connector_exec_available()) {
        return null;
    }

    $config = connector_config();
    $ffprobeBinary = connector_find_binary(str_replace('ffmpeg', 'ffprobe', $config['ffmpegBinary'])) ?: connector_find_binary('ffprobe');
    if ($ffprobeBinary === null) {
        return null;
    }

    $command = sprintf(
        '%s -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 %s 2>&1',
        connector_shell_value($ffprobeBinary),
        connector_shell_value($audioPath)
    );
    $output = [];
    $exitCode = 1;
    @exec($command, $output, $exitCode);

    if ($exitCode !== 0 || empty($output[0])) {
        return null;
    }

    return round((float) $output[0], 3);
}
