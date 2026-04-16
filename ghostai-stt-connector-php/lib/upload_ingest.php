<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function store_uploaded_media(array $file): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Upload failed or no file provided.');
    }

    $config = connector_config();
    $size = (int) ($file['size'] ?? 0);
    if ($size <= 0 || $size > $config['maxUploadBytes']) {
        throw new RuntimeException('Uploaded file exceeds the connector size limit.');
    }

    $originalName = (string) ($file['name'] ?? 'upload.bin');
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $safeBase = preg_replace('/[^a-zA-Z0-9_-]+/', '-', pathinfo($originalName, PATHINFO_FILENAME)) ?: 'upload';
    $storedName = connector_unique_basename($safeBase) . ($extension ? '.' . $extension : '');
    $storedPath = $config['uploadsDir'] . DIRECTORY_SEPARATOR . $storedName;

    if (!move_uploaded_file((string) $file['tmp_name'], $storedPath)) {
        throw new RuntimeException('Unable to move uploaded file.');
    }

    return [
        'path' => $storedPath,
        'originalName' => $originalName,
        'mimeType' => (string) ($file['type'] ?? ''),
    ];
}
