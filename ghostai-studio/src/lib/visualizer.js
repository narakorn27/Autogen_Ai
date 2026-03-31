// ========================================== //
//  👻 GhostAI Studio — Oscilloscope           //
// ========================================== //

let visualizerCanvas, canvasCtx;
let visualizerDataArray, bufferLength;

function initVisualizer() {
    visualizerCanvas = document.getElementById('visualizer');
    if (!visualizerCanvas) return;

    canvasCtx = visualizerCanvas.getContext('2d');

    // Scale canvas for sharp retina display
    const dpr = window.devicePixelRatio || 1;
    const rect = visualizerCanvas.getBoundingClientRect();
    visualizerCanvas.width = rect.width * dpr;
    visualizerCanvas.height = rect.height * dpr;
    canvasCtx.scale(dpr, dpr);

    if (typeof analyser !== 'undefined') {
        bufferLength = analyser.frequencyBinCount;
        visualizerDataArray = new Uint8Array(bufferLength);
    }
    drawWaveform();
}

function drawWaveform() {
    requestAnimationFrame(drawWaveform);
    const width = visualizerCanvas.width / (window.devicePixelRatio || 1);
    const height = visualizerCanvas.height / (window.devicePixelRatio || 1);

    // Fade effect for the background 
    canvasCtx.fillStyle = 'rgba(5, 5, 5, 0.2)';
    canvasCtx.fillRect(0, 0, width, height);

    if (typeof analyser === 'undefined' || !visualizerDataArray) return;
    analyser.getByteTimeDomainData(visualizerDataArray);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#00ff00'; // สีเขียว CRT หลอนๆ
    canvasCtx.shadowBlur = 10;
    canvasCtx.shadowColor = '#00ff00';
    canvasCtx.beginPath();

    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = visualizerDataArray[i] / 128.0;
        const y = v * (height / 2);
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
    }

    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();
}
