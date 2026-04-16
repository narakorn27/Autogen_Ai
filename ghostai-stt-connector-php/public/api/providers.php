<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/response_helpers.php';

connector_handle_preflight();
connector_require_method('GET');

connector_json_response([
    'ok' => true,
    'providers' => [
        [
            'mode' => 'managed_google',
            'label' => 'Managed Google Cloud STT',
            'requiresUserKey' => false,
            'sourceTypes' => ['youtube', 'upload'],
        ],
        [
            'mode' => 'byo_google',
            'label' => 'BYO Google Cloud STT',
            'requiresUserKey' => true,
            'sourceTypes' => ['youtube', 'upload'],
        ],
    ],
]);
