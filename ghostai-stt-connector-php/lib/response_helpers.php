<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function connector_send_cors_headers(): void
{
    $config = connector_config();
    $origin = $config['allowedOrigin'];
    if ($origin === '*') {
        header('Access-Control-Allow-Origin: *');
    } else {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}

function connector_handle_preflight(): void
{
    connector_send_cors_headers();
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function connector_json_response(array $payload, int $status = 200): void
{
    connector_send_cors_headers();
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function connector_json_error(string $message, int $status = 400, array $extra = []): void
{
    connector_json_response(array_merge(['ok' => false, 'message' => $message], $extra), $status);
}

function connector_log_error(string $message, array $context = []): void
{
    $config = function_exists('connector_config') ? connector_config() : null;
    $logsDir = is_array($config) ? ($config['logsDir'] ?? '') : '';
    if (!is_string($logsDir) || $logsDir === '') {
        return;
    }

    if (!is_dir($logsDir)) {
        @mkdir($logsDir, 0775, true);
    }

    $line = [
        'time' => date('c'),
        'message' => $message,
        'context' => $context,
    ];

    @file_put_contents(
        rtrim($logsDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'connector-error.log',
        json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        FILE_APPEND
    );
}

function connector_require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        connector_json_error("Method {$method} required.", 405);
    }
}

function connector_read_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        connector_json_error('Invalid JSON payload.', 422);
    }

    return $decoded;
}
