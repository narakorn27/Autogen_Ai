<?php
// ── Admin Panel — จัดการ License Keys ──
// ⚠️ ตั้ง password ก่อนใช้งาน!

session_start();
$ADMIN_PASS = 'Dev_New27'; // ← เปลี่ยนทันที!

// Simple auth
if (!isset($_SESSION['admin_logged_in'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['pass'] ?? '') === $ADMIN_PASS) {
        $_SESSION['admin_logged_in'] = true;
    } else {
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Login</title>
        <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;}
        form{background:#16213e;padding:40px;border-radius:12px;color:#fff;}
        input{padding:10px;border:1px solid #444;border-radius:6px;background:#0f3460;color:#fff;width:200px;margin:8px 0;}
        button{padding:10px 24px;background:#e94560;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:bold;}
        </style></head><body>
        <form method="POST"><h2>🔐 Admin Login</h2>
        <input type="password" name="pass" placeholder="Password" autofocus>
        <br><button type="submit">เข้าสู่ระบบ</button></form></body></html>';
        exit;
    }
}

require_once __DIR__ . '/../inc/db.php';
require_once __DIR__ . '/../inc/auth.php';

$db = getDB();
$msg = '';

// ── Actions ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'create') {
        $key = generateLicenseKey();
        $product = $_POST['product'] ?? 'arin-meta-bot';
        $plan = $_POST['plan_type'] ?? 'monthly';
        $days = ['daily' => 1, 'weekly' => 7, 'monthly' => 30];
        $expDays = $days[$plan] ?? 30;
        $name = $_POST['customer_name'] ?? '';
        $email = $_POST['customer_email'] ?? '';
        $maxDev = (int)($_POST['max_devices'] ?? 1);

        $stmt = $db->prepare('INSERT INTO licenses (license_key, customer_name, customer_email, product, plan_type, max_devices, expires_at) VALUES (:key, :name, :email, :product, :plan, :max, DATE_ADD(NOW(), INTERVAL :days DAY))');
        $stmt->execute(['key' => $key, 'name' => $name, 'email' => $email, 'product' => $product, 'plan' => $plan, 'max' => $maxDev, 'days' => $expDays]);
        $msg = "✅ สร้าง License สำเร็จ: <strong>$key</strong>";

    } elseif ($action === 'revoke') {
        $id = (int)($_POST['id'] ?? 0);
        $db->prepare('UPDATE licenses SET is_active = 0 WHERE id = :id')->execute(['id' => $id]);
        $db->prepare('DELETE FROM device_bindings WHERE license_id = :id')->execute(['id' => $id]);
        $msg = "🚫 ยกเลิก License #$id แล้ว";

    } elseif ($action === 'extend') {
        $id = (int)($_POST['id'] ?? 0);
        $days = (int)($_POST['extend_days'] ?? 30);
        $db->prepare('UPDATE licenses SET expires_at = DATE_ADD(GREATEST(expires_at, NOW()), INTERVAL :days DAY), is_active = 1 WHERE id = :id')->execute(['id' => $id, 'days' => $days]);
        $msg = "⏰ ขยายเวลา License #$id อีก $days วัน";

    } elseif ($action === 'logout') {
        session_destroy();
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    }
}

// ── Fetch Data ──
$licenses = $db->query('SELECT l.*, (SELECT COUNT(*) FROM device_bindings WHERE license_id = l.id) as device_count FROM licenses l ORDER BY l.created_at DESC')->fetchAll();
$stats = $db->query("SELECT 
    COUNT(*) as total,
    SUM(is_active = 1 AND expires_at > NOW()) as active,
    SUM(expires_at <= NOW()) as expired
    FROM licenses")->fetch();
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>License Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; }
        .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
        h1 { color: #7c3aed; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-card { background: #1a1a2e; border-radius: 10px; padding: 16px; text-align: center; }
        .stat-card .num { font-size: 28px; font-weight: bold; color: #7c3aed; }
        .stat-card .label { font-size: 12px; opacity: 0.7; }
        .card { background: #1a1a2e; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
        .card h3 { margin-bottom: 16px; color: #a78bfa; }
        .form-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 12px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 11px; opacity: 0.7; }
        select, input[type=text], input[type=email], input[type=number] {
            padding: 8px 12px; border-radius: 6px; border: 1px solid #333;
            background: #12122a; color: #fff; font-size: 13px; min-width: 140px;
        }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
        .btn-primary { background: #7c3aed; color: #fff; }
        .btn-danger { background: #ef4444; color: #fff; }
        .btn-success { background: #10b981; color: #fff; }
        .btn-sm { padding: 4px 10px; font-size: 11px; }
        .msg { padding: 12px; background: #1e3a5f; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #7c3aed; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #333; color: #a78bfa; font-size: 11px; text-transform: uppercase; }
        td { padding: 10px 8px; border-bottom: 1px solid #1e1e3a; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .badge-ok { background: #064e3b; color: #6ee7b7; }
        .badge-exp { background: #7f1d1d; color: #fca5a5; }
        .badge-off { background: #333; color: #888; }
        .key-text { font-family: monospace; background: #12122a; padding: 2px 6px; border-radius: 4px; letter-spacing: 1px; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .logout-btn { background: none; border: 1px solid #444; color: #888; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; }
    </style>
</head>
<body>
<div class="wrap">
    <div class="topbar">
        <h1>🔑 License Admin</h1>
        <form method="POST" style="display:inline;"><input type="hidden" name="action" value="logout"><button class="logout-btn" type="submit">ออกจากระบบ</button></form>
    </div>

    <?php if ($msg): ?><div class="msg"><?= $msg ?></div><?php endif; ?>

    <!-- Stats -->
    <div class="stats">
        <div class="stat-card"><div class="num"><?= $stats['total'] ?? 0 ?></div><div class="label">ทั้งหมด</div></div>
        <div class="stat-card"><div class="num"><?= $stats['active'] ?? 0 ?></div><div class="label">Active</div></div>
        <div class="stat-card"><div class="num"><?= $stats['expired'] ?? 0 ?></div><div class="label">Expired</div></div>
    </div>

    <!-- Create New -->
    <div class="card">
        <h3>➕ สร้าง License ใหม่</h3>
        <form method="POST">
            <input type="hidden" name="action" value="create">
            <div class="form-row">
                <div class="field">
                    <label>Product</label>
                    <select name="product">
                        <option value="arin-meta-bot">Arin Meta Bot</option>
                        <option value="arin-grok-bot">Arin Grok Bot</option>
                        <option value="arin-auto-bot">Arin Auto Bot</option>
                        <option value="arin-qwen-bot">Arin Qwen Bot</option>
                    </select>
                </div>
                <div class="field">
                    <label>Plan</label>
                    <select name="plan_type">
                        <option value="daily">Daily (1 วัน)</option>
                        <option value="weekly">Weekly (7 วัน)</option>
                        <option value="monthly" selected>Monthly (30 วัน)</option>
                    </select>
                </div>
                <div class="field">
                    <label>Max Devices</label>
                    <input type="number" name="max_devices" value="1" min="1" max="5" style="width:70px;">
                </div>
                <div class="field">
                    <label>ชื่อลูกค้า</label>
                    <input type="text" name="customer_name" placeholder="ชื่อ (optional)">
                </div>
                <div class="field">
                    <label>Email</label>
                    <input type="email" name="customer_email" placeholder="email (optional)">
                </div>
                <button class="btn btn-primary" type="submit">🔑 สร้าง Key</button>
            </div>
        </form>
    </div>

    <!-- License List -->
    <div class="card">
        <h3>📋 รายการ License (<?= count($licenses) ?>)</h3>
        <table>
            <thead>
                <tr><th>#</th><th>Key</th><th>Product</th><th>Plan</th><th>ลูกค้า</th><th>Devices</th><th>หมดอายุ</th><th>สถานะ</th><th>Actions</th></tr>
            </thead>
            <tbody>
            <?php foreach ($licenses as $lic): 
                $isActive = $lic['is_active'] && strtotime($lic['expires_at']) > time();
                $isExpired = strtotime($lic['expires_at']) <= time();
            ?>
                <tr>
                    <td><?= $lic['id'] ?></td>
                    <td><span class="key-text"><?= htmlspecialchars($lic['license_key']) ?></span></td>
                    <td><?= htmlspecialchars($lic['product']) ?></td>
                    <td><?= $lic['plan_type'] ?></td>
                    <td><?= htmlspecialchars($lic['customer_name'] ?: '-') ?></td>
                    <td><?= $lic['device_count'] ?>/<?= $lic['max_devices'] ?></td>
                    <td><?= $lic['expires_at'] ?></td>
                    <td>
                        <?php if (!$lic['is_active']): ?>
                            <span class="badge badge-off">Revoked</span>
                        <?php elseif ($isExpired): ?>
                            <span class="badge badge-exp">Expired</span>
                        <?php else: ?>
                            <span class="badge badge-ok">Active</span>
                        <?php endif; ?>
                    </td>
                    <td style="white-space:nowrap;">
                        <form method="POST" style="display:inline;">
                            <input type="hidden" name="action" value="extend">
                            <input type="hidden" name="id" value="<?= $lic['id'] ?>">
                            <input type="number" name="extend_days" value="30" min="1" style="width:50px;padding:3px;">
                            <button class="btn btn-success btn-sm" type="submit">+วัน</button>
                        </form>
                        <?php if ($lic['is_active']): ?>
                        <form method="POST" style="display:inline;" onsubmit="return confirm('ยกเลิก License นี้?')">
                            <input type="hidden" name="action" value="revoke">
                            <input type="hidden" name="id" value="<?= $lic['id'] ?>">
                            <button class="btn btn-danger btn-sm" type="submit">ยกเลิก</button>
                        </form>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
</body>
</html>
