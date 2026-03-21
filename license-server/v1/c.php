<?php
// ── verify.php — ตรวจ License + ส่ง Core Code กลับ ──
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../inc/auth.php';

$input = json_decode(file_get_contents('php://input'), true);
$key       = trim($input['k'] ?? '');      // license key
$machineId = trim($input['m'] ?? '');      // machine fingerprint
$product   = trim($input['p'] ?? '');      // product name (e.g. arin-meta-bot)

if (!$key || !$machineId || !$product) {
    echo json_encode(['success' => false, 'message' => 'Missing parameters']);
    exit;
}

// 1. ตรวจ license
$license = validateLicense($key, $product);
if (!$license) {
    logUsage(null, 'verify_fail', $_SERVER['REMOTE_ADDR'] ?? '');
    echo json_encode(['success' => false, 'message' => 'License ไม่ถูกต้องหรือหมดอายุ']);
    exit;
}

// 2. ตรวจ/ผูก device
if (!bindDevice($license['id'], $machineId, (int)$license['max_devices'])) {
    logUsage($license['id'], 'device_limit', $_SERVER['REMOTE_ADDR'] ?? '');
    echo json_encode(['success' => false, 'message' => 'เกินจำนวนอุปกรณ์ที่อนุญาต (สูงสุด ' . $license['max_devices'] . ' เครื่อง)']);
    exit;
}

// 3. อ่าน core files
$coreDir = __DIR__ . '/../core/' . basename($product) . '/';
$codeFiles = ['background', 'content', 'sidepanel', 'injected'];
$code = [];

foreach ($codeFiles as $file) {
    $path = $coreDir . 'core_' . $file . '.js';
    if (file_exists($path)) {
        $code[$file] = file_get_contents($path);
    }
}

if (empty($code)) {
    echo json_encode(['success' => false, 'message' => 'Product not found']);
    exit;
}

// 4. Log
logUsage($license['id'], 'verify_ok', $_SERVER['REMOTE_ADDR'] ?? '');

// 5. Response
echo json_encode([
    'success'    => true,
    'expires_at' => $license['expires_at'],
    'plan'       => $license['plan_type'],
    'code'       => $code
]);
