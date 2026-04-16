<?php
declare(strict_types=1);

function connector_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $root = dirname(__DIR__);
    $storage = $root . DIRECTORY_SEPARATOR . 'storage';

    $config = [
        'root' => $root,
        'allowedOrigin' => trim((string) getenv('GHOSTAI_ALLOWED_ORIGIN')) ?: '*',
        'managedGoogleApiKey' => trim((string) getenv('GHOSTAI_GOOGLE_STT_API_KEY')),
        'ffmpegBinary' => trim((string) getenv('GHOSTAI_FFMPEG_BINARY')) ?: 'ffmpeg',
        'ytDlpBinary' => trim((string) getenv('GHOSTAI_YTDLP_BINARY')) ?: 'yt-dlp',
        'maxUploadBytes' => max(1048576, (int) (getenv('GHOSTAI_MAX_UPLOAD_BYTES') ?: 314572800)),
        'uploadsDir' => $storage . DIRECTORY_SEPARATOR . 'uploads',
        'tempAudioDir' => $storage . DIRECTORY_SEPARATOR . 'temp_audio',
        'transcriptsDir' => $storage . DIRECTORY_SEPARATOR . 'transcripts',
        'logsDir' => $storage . DIRECTORY_SEPARATOR . 'logs',
    ];

    return $config;
}

function connector_exec_available(): bool
{
    return function_exists('exec');
}

function connector_shell_value(string $value): string
{
    return escapeshellarg($value);
}

function connector_windows_safe_template(string $value): string
{
    if (strtoupper(substr(PHP_OS, 0, 3)) !== 'WIN') {
        return $value;
    }

    return str_replace('%', '%%', $value);
}

function connector_storage_dirs(): array
{
    $config = connector_config();
    return [
        $config['uploadsDir'],
        $config['tempAudioDir'],
        $config['transcriptsDir'],
        $config['logsDir'],
    ];
}

function connector_ensure_storage_dirs(): void
{
    foreach (connector_storage_dirs() as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
    }
}

function connector_is_writable_dir(string $dir): bool
{
    return is_dir($dir) && is_writable($dir);
}

function connector_find_binary(string $binary): ?string
{
    if ($binary === '') {
        return null;
    }

    if (is_file($binary)) {
        return $binary;
    }

    if (!connector_exec_available()) {
        return null;
    }

    $command = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN'
        ? 'where ' . escapeshellarg($binary) . ' 2>NUL'
        : 'command -v ' . escapeshellarg($binary) . ' 2>/dev/null';

    $output = [];
    $exitCode = 1;
    @exec($command, $output, $exitCode);

    if ($exitCode !== 0 || empty($output[0])) {
        return null;
    }

    return trim((string) $output[0]) ?: null;
}

function connector_unique_basename(string $prefix = 'ghostai'): string
{
    return preg_replace('/[^a-zA-Z0-9_-]+/', '-', $prefix) . '-' . date('Ymd-His') . '-' . substr(bin2hex(random_bytes(6)), 0, 12);
}
