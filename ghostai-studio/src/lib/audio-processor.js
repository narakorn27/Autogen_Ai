// ========================================== //
//  👻 GhostAI Studio — Audio Pipeline         //
// ========================================== //

let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let convolver, filterBass, analyser, masterGain, reverbGain;

function initAudioEngine() {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    masterGain = audioCtx.createGain();
    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.4; // ลดความก้องลงไม่ให้กลบเสียงหลัก

    // Create synthetic reverb (เสียงก้องในห้องกว้างๆ)
    convolver = audioCtx.createConvolver();
    convolver.buffer = createReverbBuffer(audioCtx, 2.5, 2.0);

    // Routing: Convolver -> ReverbGain -> MasterGain -> Analyser -> Output
    convolver.connect(reverbGain);
    reverbGain.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
}

// สร้างเสียง Reverb สังเคราะห์ ไม่ต้องใช้ไฟล์ภายนอก
function createReverbBuffer(ctx, duration, decay) {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
        const channelData = impulse.getChannelData(c);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
}

// สั่งเล่นเสียงที่ผ่าน Effect (Realtime)
async function playGhostAudio(buffer, useReverb = true, pitchRate = 1.0) {
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const audioBuffer = await audioCtx.decodeAudioData(buffer.slice(0)); // slice to avoid detached buffer

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = pitchRate;

    if (useReverb) {
        source.connect(masterGain); // เปิดเสียงคนพูดปกติ (Dry)
        source.connect(convolver);  // ส่งเข้าเอฟเฟกต์ก้อง (Wet)
    } else {
        source.connect(masterGain);
    }
    source.start(0);
    return source;
}

// =============================================
// 🎛️ OFFLINE RENDERING (สำหรับ Export WAV)
// =============================================

// Render audio ผ่าน FX แบบ Offline (ไม่ต้องเล่น)
async function renderAudioOffline(rawBuffer, useReverb, pitchRate) {
    // Decode raw buffer ก่อน
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await tempCtx.decodeAudioData(rawBuffer.slice(0));
    tempCtx.close();

    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    // คำนวณ duration ใหม่ตาม pitch rate + reverb tail
    const reverbTail = useReverb ? 2.5 : 0;
    const outputLength = Math.ceil((audioBuffer.length / pitchRate) + (sampleRate * reverbTail));

    const offlineCtx = new OfflineAudioContext(channels, outputLength, sampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = pitchRate;

    if (useReverb) {
        const offlineConvolver = offlineCtx.createConvolver();
        offlineConvolver.buffer = createReverbBuffer(offlineCtx, 2.5, 2.0);

        const wetGain = offlineCtx.createGain();
        wetGain.gain.value = 0.4; // Wet level

        source.connect(offlineCtx.destination); // Dry
        source.connect(offlineConvolver);       // -> Reverb
        offlineConvolver.connect(wetGain);
        wetGain.connect(offlineCtx.destination);
    } else {
        source.connect(offlineCtx.destination);
    }

    source.start(0);
    return await offlineCtx.startRendering();
}

// =============================================
// 📦 WAV ENCODER
// =============================================

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    // Interleave channels
    let interleaved;
    if (numChannels >= 2) {
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        interleaved = new Float32Array(left.length * 2);
        for (let i = 0; i < left.length; i++) {
            interleaved[i * 2] = left[i];
            interleaved[i * 2 + 1] = right[i];
        }
    } else {
        interleaved = buffer.getChannelData(0);
    }

    const dataLength = interleaved.length * bytesPerSample;
    const wavBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(wavBuffer);

    // RIFF header
    wavWriteString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    wavWriteString(view, 8, 'WAVE');

    // fmt chunk
    wavWriteString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);          // chunk size
    view.setUint16(20, 1, true);           // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    wavWriteString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // PCM samples
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++) {
        const s = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
}

function wavWriteString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// =============================================
// 💾 DOWNLOAD HELPER
// =============================================

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// =============================================
// 🔥 EXPORT FUNCTIONS (เรียกจาก UI)
// =============================================

// Export WAV พร้อม FX (Reverb + Pitch)
async function exportAudioWithFX(storyText) {
    const statusEl = document.getElementById('export-status');
    if (statusEl) statusEl.innerHTML = '<span class="text-yellow-500 animate-pulse">⏳ กำลัง Synthesize + Render FX...</span>';

    try {
        // 1. สร้างเสียงจาก Cloud TTS
        let voiceId = 'Charon';
        document.querySelectorAll('.voice-opt').forEach(opt => {
            if (!opt.querySelector('.lucide-check-circle-2:not(.hidden)')) return;
            voiceId = opt.getAttribute('data-voice') || 'Charon';
        });

        const rawBuffer = await synthesizeCloudTTS(storyText, voiceId);
        if (!rawBuffer) {
            // Fallback: ใช้ Web Speech API สร้าง audio ไม่ได้ ต้องใช้ Cloud TTS
            if (statusEl) statusEl.innerHTML = '<span class="text-red-500">❌ ต้องตั้งค่า Google Cloud TTS Key ก่อน Export ได้</span>';
            return;
        }

        // 2. อ่าน FX settings
        const useReverb = document.getElementById('fx-reverb')?.checked ?? true;
        const isPitch = document.getElementById('fx-pitch')?.checked ?? false;
        const pitchRate = isPitch ? 0.8 : 1.0;

        // 3. Render offline ผ่าน FX
        if (statusEl) statusEl.innerHTML = '<span class="text-yellow-500 animate-pulse">🎛️ กำลัง Render Audio Effects...</span>';
        const renderedBuffer = await renderAudioOffline(rawBuffer, useReverb, pitchRate);

        // 4. Encode เป็น WAV
        const wavBlob = audioBufferToWav(renderedBuffer);

        // 5. Download
        const timestamp = new Date().toISOString().slice(0, 10);
        downloadBlob(wavBlob, `ghostai-story-fx-${timestamp}.wav`);

        if (statusEl) statusEl.innerHTML = '<span class="text-green-500 font-bold">✅ Export WAV + FX สำเร็จ!</span>';
    } catch (err) {
        console.error('[GhostAI] Export FX Error:', err);
        if (statusEl) statusEl.innerHTML = `<span class="text-red-500">❌ Export ล้มเหลว: ${err.message}</span>`;
    }
}

// Export WAV ดิบ (ไม่มี FX)
async function exportAudioRaw(storyText) {
    const statusEl = document.getElementById('export-status');
    if (statusEl) statusEl.innerHTML = '<span class="text-yellow-500 animate-pulse">⏳ กำลัง Synthesize เสียงดิบ...</span>';

    try {
        let voiceId = 'Charon';
        document.querySelectorAll('.voice-opt').forEach(opt => {
            if (!opt.querySelector('.lucide-check-circle-2:not(.hidden)')) return;
            voiceId = opt.getAttribute('data-voice') || 'Charon';
        });

        const rawBuffer = await synthesizeCloudTTS(storyText, voiceId);
        if (!rawBuffer) {
            if (statusEl) statusEl.innerHTML = '<span class="text-red-500">❌ ต้องตั้งค่า Google Cloud TTS Key ก่อน</span>';
            return;
        }

        // Decode แล้ว encode เป็น WAV
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await tempCtx.decodeAudioData(rawBuffer.slice(0));
        tempCtx.close();

        const wavBlob = audioBufferToWav(audioBuffer);
        const timestamp = new Date().toISOString().slice(0, 10);
        downloadBlob(wavBlob, `ghostai-story-raw-${timestamp}.wav`);

        if (statusEl) statusEl.innerHTML = '<span class="text-green-500 font-bold">✅ Export Raw WAV สำเร็จ!</span>';
    } catch (err) {
        console.error('[GhostAI] Export Raw Error:', err);
        if (statusEl) statusEl.innerHTML = `<span class="text-red-500">❌ Export ล้มเหลว: ${err.message}</span>`;
    }
}
