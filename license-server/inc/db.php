<?php
// ── Database Connection (PDO) ──

define('DB_HOST', 'localhost');
define('DB_NAME', 'parago_arin_ar_26');  // ← เปลี่ยนตามชื่อ DB ที่สร้าง
define('DB_USER', 'parago_arin_ar_26');    // ← เปลี่ยนตาม user
define('DB_PASS', 'vUCSwEsWFUkBMHYemLn6');    // ← เปลี่ยนตาม password

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed']);
            exit;
        }
    }
    return $pdo;
}
