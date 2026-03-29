// offscreen.js
// Handles Canvas-based text overlay for images in the background

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;

    if (message.action === 'renderTextOverlay') {
        const { imageUrl, headline, subline, logoUrl, keywords = [] } = message.data;
        renderTextOverlay(imageUrl, headline, subline, logoUrl, keywords).then(sendResponse);
        return true; // Keep message channel open for async response
    }
});

// Preload local font
const font = new FontFace('Prompt', 'url(fonts/Prompt-Bold.ttf)', { weight: '700' });
font.load().then((loadedFont) => {
    document.fonts.add(loadedFont);
    console.log('[Offscreen] Local Prompt font loaded');
}).catch(console.error);

async function renderTextOverlay(imageUrl, headline, subline, logoUrl, keywords) {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    
    await new Promise(resolve => img.onload = resolve);
    
    // Set canvas size to image size
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw base image
    ctx.drawImage(img, 0, 0);
    
    // Draw Overlay Plate (Semi-transparent black/red gradient)
    const plateHeight = canvas.height * 0.3;
    const gradient = ctx.createLinearGradient(0, canvas.height - plateHeight, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.3, 'rgba(0,0,0,0.7)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height - plateHeight, canvas.width, plateHeight);
    
    // Support Thai "Prompt" Font (from Google Fonts in offscreen.html)
    // Headline styling (Thai Style: Large, Bold, White)
    const fontSize = Math.floor(canvas.width * 0.06);
    ctx.font = `800 ${fontSize}px "Prompt", sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    
    // Add shadow/stroke for readability
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    
    // Wrap headline
    const maxWidth = canvas.width * 0.9;
    const x = canvas.width * 0.05;
    const y = canvas.height * 0.85;
    
    renderHighlightedText(ctx, headline, keywords, x, y, maxWidth, fontSize * 1.2);
    
    // Subline Styling (Hashtag in Red/Accent)
    if (subline) {
        const subFontSize = Math.floor(fontSize * 0.6);
        ctx.font = `600 ${subFontSize}px "Prompt", sans-serif`;
        ctx.shadowBlur = 0;
        
        let currentX = x;
        const subWords = subline.split(' ');
        for (const word of subWords) {
            const isHashtag = word.startsWith('#');
            ctx.fillStyle = isHashtag ? '#FF3366' : 'rgba(255, 255, 255, 0.8)';
            const metrics = ctx.measureText(word + ' ');
            ctx.fillText(word + ' ', currentX, canvas.height * 0.92);
            currentX += metrics.width;
        }
    }

    // [LOGO WATERMARK]
    if (logoUrl) {
        try {
            const logoImg = new Image();
            logoImg.src = logoUrl;
            await new Promise(resolve => logoImg.onload = resolve);
            
            const logoSize = canvas.width * 0.12;
            const padding = 20;
            ctx.drawImage(logoImg, canvas.width - logoSize - padding, padding, logoSize, logoSize);
        } catch (e) {
            console.warn('Failed to draw logo watermark', e);
        }
    }
    
    return canvas.toDataURL('image/jpeg', 0.9);
}

function segmentThaiText(text) {
    if (window.Intl && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('th-TH', { granularity: 'word' });
        return Array.from(segmenter.segment(text)).map(s => s.segment);
    }
    return text.split(' ');
}

function renderHighlightedText(ctx, text, keywords, x, y, maxWidth, lineHeight) {
    const words = segmentThaiText(text);
    let currentX = x;
    let currentY = y;
    
    for (const word of words) {
        const cleanWord = word.trim();
        const isKeyword = cleanWord && keywords.some(kw => cleanWord.toLowerCase().includes(kw.toLowerCase()));
        ctx.fillStyle = isKeyword ? '#FF3333' : '#FFFFFF';
        
        const metrics = ctx.measureText(word);
        if (currentX + metrics.width > x + maxWidth && currentX > x) {
            currentX = x;
            currentY += lineHeight;
        }
        ctx.strokeText(word, currentX, currentY);
        ctx.fillText(word, currentX, currentY);
        currentX += metrics.width;
    }
}
