(() => {
  if (window.__ARIN_FLOW_EXTENSION_LOADED__) {
    console.log('[ArinFlow] content.js already loaded');
    return;
  }

  window.__ARIN_FLOW_EXTENSION_LOADED__ = true;

  function log(message, level = 'INFO') {
    console.log(`[ArinFlow][${level}] ${message}`);
    try {
      chrome.runtime.sendMessage({
        source: 'content-log',
        level,
        message
      });
    } catch (e) {
      console.warn('[ArinFlow] log send failed:', e);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity || '1') > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function getElementText(el) {
    return (
      ((el.innerText || el.textContent || '') + ' ' +
      (el.getAttribute?.('aria-label') || '') + ' ' +
      (el.getAttribute?.('title') || '') + ' ' +
      (el.getAttribute?.('placeholder') || ''))
        .trim()
        .toLowerCase()
    );
  }

  function highlightElement(el, label = 'TARGET') {
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.border = '2px solid #22c55e';
    overlay.style.background = 'rgba(34, 197, 94, 0.12)';
    overlay.style.zIndex = '999999';
    overlay.style.pointerEvents = 'none';
    overlay.style.borderRadius = '8px';

    const badge = document.createElement('div');
    badge.textContent = label;
    badge.style.position = 'absolute';
    badge.style.top = '-22px';
    badge.style.left = '0';
    badge.style.background = '#22c55e';
    badge.style.color = '#fff';
    badge.style.fontSize = '12px';
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '6px';

    overlay.appendChild(badge);
    document.body.appendChild(overlay);

    setTimeout(() => overlay.remove(), 2500);
  }

  async function waitForCondition(checkFn, label, timeoutMs = 20000, intervalMs = 500) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const result = checkFn();
        if (result) {
          log(`waitForCondition success: ${label}`);
          return result;
        }
      } catch (error) {
        // ignore polling errors
      }

      await sleep(intervalMs);
    }

    throw new Error(`Timeout waiting for: ${label}`);
  }

  async function waitForPageReady() {
    log('Waiting for page ready...');
    await waitForCondition(
      () => document.readyState === 'interactive' || document.readyState === 'complete',
      'document readyState'
    );

    await sleep(1200);
    log('Page ready.');
  }

  function getAllPromptCandidates() {
    const selectors = [
      'textarea',
      'input[type="text"]',
      'input:not([type])',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'div[aria-multiline="true"]'
    ];

    const nodes = selectors.flatMap(selector =>
      Array.from(document.querySelectorAll(selector))
    );

    const unique = Array.from(new Set(nodes));
    return unique.filter(isVisible);
  }

  function getAllVisibleFileInputs() {
    return Array.from(document.querySelectorAll('input[type="file"]'));
  }

  function getAllButtonsLike() {
    const candidates = [
      ...Array.from(document.querySelectorAll('button')),
      ...Array.from(document.querySelectorAll('[role="button"]')),
      ...Array.from(document.querySelectorAll('div')),
      ...Array.from(document.querySelectorAll('span'))
    ];

    return candidates.filter(isVisible);
  }

  function findPromptInput() {
    const candidates = getAllPromptCandidates();

    if (!candidates.length) return null;

    const scored = candidates.map((el) => {
      const text = getElementText(el);
      const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const role = (el.getAttribute('role') || '').toLowerCase();
      const tag = el.tagName.toLowerCase();
      const contentEditable = el.getAttribute('contenteditable');

      let score = 0;

      if (tag === 'textarea') score += 8;
      if (tag === 'input') score += 5;
      if (contentEditable === 'true') score += 10;
      if (role === 'textbox') score += 8;

      if (placeholder.includes('prompt')) score += 15;
      if (placeholder.includes('describe')) score += 10;
      if (placeholder.includes('ask')) score += 6;
      if (placeholder.includes('message')) score += 5;

      if (ariaLabel.includes('prompt')) score += 15;
      if (ariaLabel.includes('describe')) score += 10;
      if (ariaLabel.includes('text')) score += 4;
      if (ariaLabel.includes('message')) score += 5;

      if (text.includes('prompt')) score += 8;
      if (text.includes('describe')) score += 6;
      if (text.includes('image')) score += 3;

      const rect = el.getBoundingClientRect();
      if (rect.width > 250) score += 3;
      if (rect.height > 32) score += 2;

      return { el, score, tag, placeholder, ariaLabel, role, contentEditable };
    });

    scored.sort((a, b) => b.score - a.score);

    log(
      'Prompt candidates: ' +
      scored
        .slice(0, 8)
        .map(item =>
          `${item.tag} score=${item.score} placeholder="${item.placeholder}" aria="${item.ariaLabel}" role="${item.role}" ce="${item.contentEditable || ''}"`
        )
        .join(' | ')
    );

    return scored[0]?.el || null;
  }

  function findFileInput() {
    const inputs = getAllVisibleFileInputs();

    if (inputs.length === 1) return inputs[0];
    if (inputs.length > 1) return inputs[0];

    const hiddenInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    if (hiddenInputs.length) return hiddenInputs[0];

    return null;
  }

  function findGenerateButton() {
    const candidates = getAllButtonsLike();

    const keywords = [
      'generate',
      'create',
      'run',
      'สร้าง',
      'generate image',
      'generate images'
    ];

    const scored = candidates.map((el) => {
      const text = getElementText(el);
      let score = 0;

      for (const key of keywords) {
        if (text.includes(key)) score += 12;
      }

      if (el.tagName.toLowerCase() === 'button') score += 2;
      if (el.getAttribute('role') === 'button') score += 2;
      if (el.hasAttribute('disabled')) score -= 5;
      if (el.getAttribute('aria-disabled') === 'true') score -= 5;

      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 28) score += 1;

      return { el, score, text };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    if (best && best.score > 0) return best.el;
    return null;
  }

  function dispatchNativeInputEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
  }

  async function fillPrompt(prompt) {
    const inputEl = await waitForCondition(findPromptInput, 'prompt input');

    highlightElement(inputEl, 'PROMPT');
    inputEl.focus();

    const tag = inputEl.tagName.toLowerCase();
    const isContentEditable = inputEl.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
      inputEl.innerHTML = '';
      inputEl.textContent = prompt;

      try {
        inputEl.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: prompt
        }));
      } catch (e) {
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }

      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (tag === 'textarea') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(inputEl, prompt);
      } else {
        inputEl.value = prompt;
      }

      dispatchNativeInputEvents(inputEl);
    } else if (tag === 'input') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(inputEl, prompt);
      } else {
        inputEl.value = prompt;
      }

      dispatchNativeInputEvents(inputEl);
    } else {
      inputEl.textContent = prompt;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    log(`Prompt filled (${prompt.length} chars).`, 'OK');
    await sleep(1000);
  }

  function dataURLtoFile(dataUrl, filename, mimeType = 'image/png') {
    const arr = dataUrl.split(',');
    const mime = mimeType || arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  }

  async function uploadImages(images) {
    const input = await waitForCondition(findFileInput, 'file input');

    highlightElement(input, 'FILE INPUT');

    log(`Found file input. Uploading ${images.length} image(s)...`);

    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      const file = dataURLtoFile(
        item.dataUrl,
        item.name || `image-${i + 1}.png`,
        item.type || 'image/png'
      );

      const dt = new DataTransfer();
      dt.items.add(file);

      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      log(`Uploaded image ${i + 1}/${images.length}: ${file.name}`, 'OK');
      await sleep(3500);
    }
  }

  async function clickGenerate() {
    const button = await waitForCondition(findGenerateButton, 'generate button');

    highlightElement(button, 'GENERATE');

    if (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') {
      log('Generate button found but disabled.', 'WARN');
    }

    button.click();
    log('Generate button clicked.', 'OK');
  }

  async function testSelectors() {
    await waitForPageReady();

    const promptCandidates = getAllPromptCandidates();
    log(`Found ${promptCandidates.length} prompt candidate(s).`);

    promptCandidates.slice(0, 10).forEach((el, index) => {
      const tag = el.tagName.toLowerCase();
      const placeholder = el.getAttribute('placeholder') || '';
      const aria = el.getAttribute('aria-label') || '';
      const role = el.getAttribute('role') || '';
      const ce = el.getAttribute('contenteditable') || '';
      log(
        `Candidate ${index + 1}: <${tag}> placeholder="${placeholder}" aria="${aria}" role="${role}" contenteditable="${ce}"`
      );
    });

    const promptInput = findPromptInput();
    const fileInput = findFileInput();
    const generateButton = findGenerateButton();

    if (promptInput) {
      highlightElement(promptInput, 'PROMPT');
      log('Prompt input found.', 'OK');
    } else {
      log('Prompt input not found.', 'ERR');
    }

    if (fileInput) {
      highlightElement(fileInput, 'FILE INPUT');
      log('File input found.', 'OK');
    } else {
      log('File input not found.', 'ERR');
    }

    if (generateButton) {
      highlightElement(generateButton, 'GENERATE');
      log('Generate button found.', 'OK');
    } else {
      log('Generate button not found.', 'ERR');
    }
  }

  async function testPrompt(prompt) {
    await waitForPageReady();
    await fillPrompt(prompt || 'test prompt from extension');
  }

  async function testUpload(images) {
    await waitForPageReady();
    await uploadImages(images || []);
  }

  async function testGenerate() {
    await waitForPageReady();
    await clickGenerate();
  }

  async function runFull(images, prompt) {
    await waitForPageReady();
    await uploadImages(images || []);
    await sleep(1200);
    await fillPrompt(prompt || '');
    await sleep(1000);
    await clickGenerate();
    log('Run Full completed.', 'OK');
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        if (message.type === 'PING') {
          sendResponse({ ok: true, message: 'pong' });
          return;
        }

        if (message.type === 'RUN_ACTION') {
          const payload = message.payload || {};
          log(`Received action: ${payload.type}`);

          if (payload.type === 'TEST_SELECTORS') {
            await testSelectors();
            sendResponse({ ok: true });
            return;
          }

          if (payload.type === 'TEST_PROMPT') {
            await testPrompt(payload.prompt);
            sendResponse({ ok: true });
            return;
          }

          if (payload.type === 'TEST_UPLOAD') {
            await testUpload(payload.images);
            sendResponse({ ok: true });
            return;
          }

          if (payload.type === 'TEST_GENERATE') {
            await testGenerate();
            sendResponse({ ok: true });
            return;
          }

          if (payload.type === 'RUN_FULL') {
            await runFull(payload.images, payload.prompt);
            sendResponse({ ok: true });
            return;
          }

          sendResponse({ ok: false, error: 'Unknown payload type' });
          return;
        }

        sendResponse({ ok: false, error: 'Unknown message type' });
      } catch (error) {
        log(error?.message || String(error), 'ERR');
        sendResponse({
          ok: false,
          error: error?.message || String(error)
        });
      }
    })();

    return true;
  });

  log('content.js loaded.', 'OK');
})();