<?php
// ── deactivate.php — ปลด Device Binding ──
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false]);
    exit;
}

require_once __DIR__ . '/../inc/auth.php';

$input = json_decode(file_get_contents('php://input'), true);
$key       = trim($input['k'] ?? '');
$machineId = trim($input['m'] ?? '');
$product   = trim($input['p'] ?? '');

if (!$key || !$machineId || !$product) {
    echo json_encode(['success' => false, 'message' => 'Missing parameters']);
    exit;
}

$license = validateLicense($key, $product);
if (!$license) {
    echo json_encode(['success' => false, 'message' => 'License ไม่ถูกต้อง']);
    exit;
}

$db = getDB();
$stmt = $db->prepare('DELETE FROM device_bindings WHERE license_id = :lid AND machine_id = :mid');
$stmt->execute(['lid' => $license['id'], 'mid' => $machineId]);

logUsage($license['id'], 'deactivate', $_SERVER['REMOTE_ADDR'] ?? '');

echo json_encode(['success' => true, 'message' => 'ปลดอุปกรณ์สำเร็จ']);
