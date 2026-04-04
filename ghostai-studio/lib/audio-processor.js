// ========================================== //
//  GhostAI Studio - Audio Pipeline          //
// ========================================== //

let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let analyser, masterGain;
let currentPlayback = null;

function initAudioEngine() {
    if (masterGain && analyser) return;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.8;

    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
}

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

function createStaticNoiseSource(ctx, duration) {
    const sampleRate = ctx.sampleRate;
    const length = Math.ceil(sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, length, sampleRate);
    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const staticFilter = ctx.createBiquadFilter();
    staticFilter.type = "bandpass";
    staticFilter.frequency.value = 1500;
    staticFilter.Q.value = 2.0;

    const staticPanner = ctx.createStereoPanner();
    staticPanner.pan.value = (Math.random() - 0.5) * 0.35;

    const staticGain = ctx.createGain();
    staticGain.gain.value = 0;

    noiseSource.connect(staticFilter);
    staticFilter.connect(staticPanner);
    staticPanner.connect(staticGain);

    return { source: noiseSource, gain: staticGain };
}

function getCurrentFxState() {
    return {
        reverb: document.getElementById("fx-reverb")?.checked ?? false,
        pitch: document.getElementById("fx-pitch")?.checked ?? false,
        whisper: document.getElementById("fx-whisper")?.checked ?? false,
        static: document.getElementById("fx-static")?.checked ?? false,
        volume: Number(document.getElementById("vol-main")?.value ?? 80) / 100,
    };
}

function applyPlaybackFx(playback, fxState = getCurrentFxState()) {
    if (!playback || !audioCtx) return;

    const now = audioCtx.currentTime;
    const targetPitch = fxState.pitch ? 0.96 : 1.0;
    const whisperDry = fxState.whisper ? 0 : 1;
    const whisperWet = fxState.whisper ? 1 : 0;
    const reverbWet = fxState.reverb ? 0.3 : 0;
    const dryLevel = fxState.reverb ? 0.92 : 1.0;
    const staticLevel = fxState.static ? 0.055 : 0;

    playback.source.playbackRate.cancelScheduledValues(now);
    playback.source.playbackRate.setValueAtTime(playback.source.playbackRate.value, now);
    playback.source.playbackRate.linearRampToValueAtTime(targetPitch, now + 0.08);

    playback.whisperDryGain.gain.cancelScheduledValues(now);
    playback.whisperDryGain.gain.setTargetAtTime(whisperDry, now, 0.03);

    playback.whisperWetGain.gain.cancelScheduledValues(now);
    playback.whisperWetGain.gain.setTargetAtTime(whisperWet, now, 0.03);

    playback.dryGain.gain.cancelScheduledValues(now);
    playback.dryGain.gain.setTargetAtTime(dryLevel, now, 0.04);

    playback.reverbWetGain.gain.cancelScheduledValues(now);
    playback.reverbWetGain.gain.setTargetAtTime(reverbWet, now, 0.05);

    if (playback.toneLowShelf) {
        playback.toneLowShelf.gain.cancelScheduledValues(now);
        playback.toneLowShelf.gain.setTargetAtTime(fxState.pitch ? 5 : 0, now, 0.05);
    }

    if (playback.toneHighCut) {
        playback.toneHighCut.frequency.cancelScheduledValues(now);
        playback.toneHighCut.frequency.setTargetAtTime(fxState.pitch ? 3600 : 18000, now, 0.05);
    }

    if (playback.staticGain) {
        playback.staticGain.gain.cancelScheduledValues(now);
        playback.staticGain.gain.setTargetAtTime(staticLevel, now, 0.05);
    }

    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(fxState.volume, now, 0.03);
}

function stopCurrentGhostAudio() {
    if (!currentPlayback) return;

    try { currentPlayback.source.onended = null; } catch {}
    try { currentPlayback.source.stop(); } catch {}
    try { currentPlayback.staticSource?.stop(); } catch {}
    currentPlayback = null;
}

window.stopGhostPlayback = stopCurrentGhostAudio;

async function playGhostAudio(buffer, useReverb = false, pitchRate = 1.0) {
    initAudioEngine();
    if (audioCtx.state === "suspended") await audioCtx.resume();

    stopCurrentGhostAudio();

    const audioBuffer = await audioCtx.decodeAudioData(buffer.slice(0));
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = pitchRate;

    const inputGain = audioCtx.createGain();
    const toneLowShelf = audioCtx.createBiquadFilter();
    toneLowShelf.type = "lowshelf";
    toneLowShelf.frequency.value = 220;
    toneLowShelf.gain.value = 0;

    const toneHighCut = audioCtx.createBiquadFilter();
    toneHighCut.type = "lowpass";
    toneHighCut.frequency.value = 18000;

    const whisperDryGain = audioCtx.createGain();
    const whisperWetGain = audioCtx.createGain();
    const whisperFilter = audioCtx.createBiquadFilter();
    whisperFilter.type = "bandpass";
    whisperFilter.frequency.value = 3000;
    whisperFilter.Q.value = 0.8;

    const postVoiceGain = audioCtx.createGain();
    const dryGain = audioCtx.createGain();
    const convolver = audioCtx.createConvolver();
    convolver.buffer = createReverbBuffer(audioCtx, 1.8, 1.7);
    const reverbWetGain = audioCtx.createGain();

    source.connect(inputGain);
    inputGain.connect(toneLowShelf);
    toneLowShelf.connect(toneHighCut);
    toneHighCut.connect(whisperDryGain);
    toneHighCut.connect(whisperFilter);
    whisperFilter.connect(whisperWetGain);
    whisperDryGain.connect(postVoiceGain);
    whisperWetGain.connect(postVoiceGain);

    postVoiceGain.connect(dryGain);
    dryGain.connect(masterGain);

    postVoiceGain.connect(convolver);
    convolver.connect(reverbWetGain);
    reverbWetGain.connect(masterGain);

    const staticNoise = createStaticNoiseSource(audioCtx, audioBuffer.duration + 1);
    staticNoise.gain.connect(masterGain);
    staticNoise.source.start(0);

    const playback = {
        source,
        whisperDryGain,
        whisperWetGain,
        dryGain,
        reverbWetGain,
        staticGain: staticNoise.gain,
        staticSource: staticNoise.source,
        toneLowShelf,
        toneHighCut,
    };

    currentPlayback = playback;

    source.onended = () => {
        try { staticNoise.source.stop(); } catch {}
        if (currentPlayback === playback) {
            currentPlayback = null;
        }
    };

    source.start(0);
    applyPlaybackFx(playback, {
        ...getCurrentFxState(),
        reverb: useReverb,
        pitch: pitchRate < 1,
    });

    return source;
}

function updateAudioFX() {
    initAudioEngine();
    const fxState = getCurrentFxState();
    applyPlaybackFx(currentPlayback, fxState);

    const activeFx = [];
    if (fxState.reverb) activeFx.push("Reverb");
    if (fxState.pitch) activeFx.push("Pitch Low");
    if (fxState.whisper) activeFx.push("Whisper");
    if (fxState.static) activeFx.push("Static");
    console.log("[GhostAI FX]", activeFx.length ? `Active: ${activeFx.join(", ")}` : "No FX active");
}

window.applyGhostRealtimeFX = updateAudioFX;

async function renderAudioOffline(rawBuffer, useReverb, pitchRate) {
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await tempCtx.decodeAudioData(rawBuffer.slice(0));
    await tempCtx.close();

    const fxWhisper = document.getElementById("fx-whisper")?.checked ?? false;
    const fxStatic = document.getElementById("fx-static")?.checked ?? false;

    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const reverbTail = useReverb ? 1.8 : 0;
    const outputLength = Math.ceil(audioBuffer.length / pitchRate + sampleRate * reverbTail);
    const offlineCtx = new OfflineAudioContext(channels, outputLength, sampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = pitchRate;

    const inputGain = offlineCtx.createGain();
    source.connect(inputGain);
    const toneLowShelf = offlineCtx.createBiquadFilter();
    toneLowShelf.type = "lowshelf";
    toneLowShelf.frequency.value = 220;
    toneLowShelf.gain.value = pitchRate < 1 ? 5 : 0;
    const toneHighCut = offlineCtx.createBiquadFilter();
    toneHighCut.type = "lowpass";
    toneHighCut.frequency.value = pitchRate < 1 ? 3600 : 18000;
    inputGain.connect(toneLowShelf);
    toneLowShelf.connect(toneHighCut);

    let voiceNode = toneHighCut;
    if (fxWhisper) {
        const whisperFilter = offlineCtx.createBiquadFilter();
        whisperFilter.type = "bandpass";
        whisperFilter.frequency.value = 3000;
        whisperFilter.Q.value = 0.8;
        voiceNode.connect(whisperFilter);
        voiceNode = whisperFilter;
    }

    const dryGain = offlineCtx.createGain();
    dryGain.gain.value = useReverb ? 0.92 : 1.0;
    voiceNode.connect(dryGain);
    dryGain.connect(offlineCtx.destination);

    if (useReverb) {
        const offlineConvolver = offlineCtx.createConvolver();
        offlineConvolver.buffer = createReverbBuffer(offlineCtx, 1.8, 1.7);
        const wetGain = offlineCtx.createGain();
        wetGain.gain.value = 0.3;
        voiceNode.connect(offlineConvolver);
        offlineConvolver.connect(wetGain);
        wetGain.connect(offlineCtx.destination);
    }

    if (fxStatic) {
        const noiseLength = Math.ceil(sampleRate * (audioBuffer.duration / pitchRate));
        const noiseBuffer = offlineCtx.createBuffer(1, noiseLength, sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseLength; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const staticFilter = offlineCtx.createBiquadFilter();
        staticFilter.type = "bandpass";
        staticFilter.frequency.value = 1500;
        staticFilter.Q.value = 2.0;

        const staticGain = offlineCtx.createGain();
        staticGain.gain.value = 0.055;

        noiseSource.connect(staticFilter);
        staticFilter.connect(staticGain);
        staticGain.connect(offlineCtx.destination);
        noiseSource.start(0);
    }

    source.start(0);
    return await offlineCtx.startRendering();
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

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

    wavWriteString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    wavWriteString(view, 8, "WAVE");
    wavWriteString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    wavWriteString(view, 36, "data");
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < interleaved.length; i++) {
        const s = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }

    return new Blob([wavBuffer], { type: "audio/wav" });
}

function wavWriteString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportAudioWithFX(storyText) {
    const statusEl = document.getElementById("export-status");
    if (statusEl) statusEl.innerHTML = '<span class="text-yellow-500 animate-pulse">กำลัง Synthesize + Render FX...</span>';

    try {
        const voiceId = typeof getSelectedVoiceId === "function" ? getSelectedVoiceId() : "Charon";
        const rawBuffer = await synthesizeCloudTTS(storyText, voiceId);
        if (!rawBuffer) {
            if (statusEl) statusEl.innerHTML = '<span class="text-red-500">ต้องตั้งค่า Google Cloud TTS Key ก่อน Export ได้</span>';
            return;
        }

        const useReverb = document.getElementById("fx-reverb")?.checked ?? false;
        const isPitch = document.getElementById("fx-pitch")?.checked ?? false;
        const pitchRate = isPitch ? 0.8 : 1.0;

        if (statusEl) statusEl.innerHTML = '<span class="text-yellow-500 animate-pulse">กำลัง Render Audio Effects...</span>';
        const renderedBuffer = await renderAudioOffline(rawBuffer, useReverb, pitchRate);
        const wavBlob = audioBufferToWav(renderedBuffer);
        const timestamp = new Date().toISOString().slice(0, 10);
        downloadBlob(wavBlob, `ghostai-story-fx-${timestamp}.wav`);

        if (statusEl) statusEl.innerHTML = '<span class="text-green-500 font-bold">Export WAV + FX สำเร็จ!</span>';
    } catch (err) {
        console.error("[GhostAI] Export FX Error:", err);
        if (statusEl) statusEl.innerHTML = `<span class="text-red-500">Export ล้มเหลว: ${err.message}</span>`;
    }
}

async function exportAudioRaw(storyText) {
    const statusEl = document.getElementById("export-status");
    if (statusEl) statusEl.innerHTML = '<span class="text-yellow-500 animate-pulse">กำลัง Synthesize เสียงดิบ...</span>';

    try {
        const voiceId = typeof getSelectedVoiceId === "function" ? getSelectedVoiceId() : "Charon";
        const rawBuffer = await synthesizeCloudTTS(storyText, voiceId);
        if (!rawBuffer) {
            if (statusEl) statusEl.innerHTML = '<span class="text-red-500">ต้องตั้งค่า Google Cloud TTS Key ก่อน</span>';
            return;
        }

        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await tempCtx.decodeAudioData(rawBuffer.slice(0));
        await tempCtx.close();

        const wavBlob = audioBufferToWav(audioBuffer);
        const timestamp = new Date().toISOString().slice(0, 10);
        downloadBlob(wavBlob, `ghostai-story-raw-${timestamp}.wav`);

        if (statusEl) statusEl.innerHTML = '<span class="text-green-500 font-bold">Export Raw WAV สำเร็จ!</span>';
    } catch (err) {
        console.error("[GhostAI] Export Raw Error:", err);
        if (statusEl) statusEl.innerHTML = `<span class="text-red-500">Export ล้มเหลว: ${err.message}</span>`;
    }
}
