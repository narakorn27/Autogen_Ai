<?php
// ── License Validation & Device Binding ──

require_once __DIR__ . '/db.php';

/**
 * ตรวจสอบ License Key
 * @return array|false — license row หรือ false
 */
function validateLicense(string $key, string $product) {
    $db = getDB();
    $stmt = $db->prepare('
        SELECT * FROM licenses 
        WHERE license_key = :key 
          AND product = :product 
          AND is_active = 1 
          AND expires_at > NOW()
    ');
    $stmt->execute(['key' => $key, 'product' => $product]);
    return $stmt->fetch() ?: false;
}

/**
 * ผูก Device กับ License (ตรวจจำนวน max_devices)
 * @return bool
 */
function bindDevice(int $licenseId, string $machineId, int $maxDevices): bool {
    $db = getDB();

    // เช็คว่า machine นี้ผูกอยู่แล้วหรือเปล่า
    $stmt = $db->prepare('
        SELECT id FROM device_bindings 
        WHERE license_id = :lid AND machine_id = :mid
    ');
    $stmt->execute(['lid' => $licenseId, 'mid' => $machineId]);
    $existing = $stmt->fetch();

    if ($existing) {
        // อัปเดต last_seen
        $db->prepare('UPDATE device_bindings SET last_seen = NOW() WHERE id = :id')
           ->execute(['id' => $existing['id']]);
        return true;
    }

    // เช็คจำนวน device ที่ผูกแล้ว
    $stmt = $db->prepare('SELECT COUNT(*) as cnt FROM device_bindings WHERE license_id = :lid');
    $stmt->execute(['lid' => $licenseId]);
    $count = (int)$stmt->fetch()['cnt'];

    if ($count >= $maxDevices) {
        return false;
    }

    // ผูก device ใหม่
    $stmt = $db->prepare('
        INSERT INTO device_bindings (license_id, machine_id, last_seen) 
        VALUES (:lid, :mid, NOW())
    ');
    $stmt->execute(['lid' => $licenseId, 'mid' => $machineId]);
    return true;
}

/**
 * บันทึก Usage Log
 */
function logUsage(?int $licenseId, string $action, string $ip) {
    $db = getDB();
    $stmt = $db->prepare('
        INSERT INTO usage_logs (license_id, action, ip_address, created_at) 
        VALUES (:lid, :action, :ip, NOW())
    ');
    $stmt->execute(['lid' => $licenseId, 'action' => $action, 'ip' => $ip]);
}

/**
 * สร้าง License Key แบบสุ่ม
 */
function generateLicenseKey(): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ไม่มี 0, O, I, 1 ป้องกันสับสน
    $key = '';
    for ($i = 0; $i < 4; $i++) {
        if ($i > 0) $key .= '-';
        for ($j = 0; $j < 4; $j++) {
            $key .= $chars[random_int(0, strlen($chars) - 1)];
        }
    }
    return $key;
}
