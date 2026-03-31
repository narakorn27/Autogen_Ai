// ========================================== //
//  👻 GhostAI Studio — Ghost Overlays         //
// ========================================== //

let idleTimer;

function initGhostOverlay() {
    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keypress', resetIdleTimer);
    resetIdleTimer();
}

// ==== IDLE HORROR (30 วิ ไม่ขยับเมาส์) ====
function resetIdleTimer() {
    clearTimeout(idleTimer);
    const textEl = document.getElementById('idle-ghost-text');
    if (textEl) textEl.classList.remove('visible');

    idleTimer = setTimeout(() => {
        console.log('[GhostAI] Idle Horror Triggered...');
        if (textEl) {
            const whispers = ["...ยังอยู่ไหม...", "...มองอะไร...", "...อยู่ข้างหลัง..."];
            textEl.innerText = whispers[Math.floor(Math.random() * whispers.length)];
            textEl.classList.add('visible');
        }
        // พูดเสียงกระซิบเบาๆ
        if (typeof synthesizeCloudTTS !== 'undefined') {
            synthesizeCloudTTS("มา... อยู่เป็นเพื่อนฉันสิ", 'spirit').then(buffer => {
                if (buffer) playGhostAudio(buffer, true, 0.5);
            });
        }
    }, 30000);
}

// ==== JUMP SCARE EFFECT ====
function triggerJumpScare() {
    let flash = document.getElementById('jumpscare-overlay');
    if (!flash) return;

    // หน้าจอแดง + VHS รวน
    flash.style.opacity = '0.85';
    document.body.style.filter = 'contrast(150%) hue-rotate(90deg)';

    // เล่นเสียง Glitch กระแทกดังๆ (ถ้ามีไฟล์) หรือเสียงตุบ
    if (typeof audioCtx !== 'undefined') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(50, audioCtx.currentTime);
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }

    setTimeout(() => {
        flash.style.opacity = '0';
        document.body.style.filter = '';
    }, 200);
}
