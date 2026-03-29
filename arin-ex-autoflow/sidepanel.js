const imageInput = document.getElementById('imageInput');
const promptInput = document.getElementById('promptInput');
const flowUrlInput = document.getElementById('flowUrl');

const btnFindTab = document.getElementById('btnFindTab');
const btnInject = document.getElementById('btnInject');
const btnSelectors = document.getElementById('btnSelectors');
const btnPrompt = document.getElementById('btnPrompt');
const btnUpload = document.getElementById('btnUpload');
const btnGenerate = document.getElementById('btnGenerate');
const btnRunFull = document.getElementById('btnRunFull');
const btnClearLog = document.getElementById('btnClearLog');

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const imageCountEl = document.getElementById('imageCount');

let selectedFiles = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function addLog(message, type = 'INFO') {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] [${type}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
  logEl.textContent = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: reader.result
      });
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getImagesPayload() {
  const files = Array.from(selectedFiles || []);
  const results = [];

  for (const file of files) {
    results.push(await fileToBase64(file));
  }

  return results;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }
      resolve(response);
    });
  });
}

imageInput.addEventListener('change', (e) => {
  selectedFiles = Array.from(e.target.files || []);
  imageCountEl.textContent = `Selected images: ${selectedFiles.length}`;
  addLog(`Selected ${selectedFiles.length} image(s)`);
});

btnClearLog.addEventListener('click', () => {
  clearLog();
  setStatus('Logs cleared.');
});

btnFindTab.addEventListener('click', async () => {
  setStatus('Finding/opening Flow tab...');
  const response = await sendMessage({
    action: 'FIND_OR_OPEN_FLOW_TAB',
    flowUrl: flowUrlInput.value.trim()
  });

  if (response?.ok) {
    setStatus(`Flow tab ready. Tab ID: ${response.tabId}`);
    addLog(`Flow tab ready. Tab ID: ${response.tabId}`, 'OK');
  } else {
    setStatus(`Failed: ${response?.error || 'Unknown error'}`);
    addLog(`Find/Open Flow failed: ${response?.error || 'Unknown error'}`, 'ERR');
  }
});

btnInject.addEventListener('click', async () => {
  setStatus('Injecting content script...');
  const response = await sendMessage({
    action: 'INJECT_CONTENT',
    flowUrl: flowUrlInput.value.trim()
  });

  if (response?.ok) {
    setStatus('Content script injected.');
    addLog('Content script injected.', 'OK');
  } else {
    setStatus(`Inject failed: ${response?.error || 'Unknown error'}`);
    addLog(`Inject failed: ${response?.error || 'Unknown error'}`, 'ERR');
  }
});

btnSelectors.addEventListener('click', async () => {
  setStatus('Testing selectors...');
  const response = await sendMessage({
    action: 'RUN_CONTENT_ACTION',
    flowUrl: flowUrlInput.value.trim(),
    payload: {
      type: 'TEST_SELECTORS'
    }
  });

  if (response?.ok) {
    setStatus('Selector test command sent.');
    addLog('Selector test command sent.', 'OK');
  } else {
    setStatus(`Selector test failed: ${response?.error || 'Unknown error'}`);
    addLog(`Selector test failed: ${response?.error || 'Unknown error'}`, 'ERR');
  }
});

btnPrompt.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();

  setStatus('Testing prompt fill...');
  const response = await sendMessage({
    action: 'RUN_CONTENT_ACTION',
    flowUrl: flowUrlInput.value.trim(),
    payload: {
      type: 'TEST_PROMPT',
      prompt
    }
  });

  if (response?.ok) {
    setStatus('Prompt test command sent.');
    addLog('Prompt test command sent.', 'OK');
  } else {
    setStatus(`Prompt test failed: ${response?.error || 'Unknown error'}`);
    addLog(`Prompt test failed: ${response?.error || 'Unknown error'}`, 'ERR');
  }
});

btnUpload.addEventListener('click', async () => {
  if (!selectedFiles.length) {
    setStatus('Please select at least 1 image.');
    addLog('No images selected for upload test.', 'ERR');
    return;
  }

  setStatus('Preparing images for upload test...');
  const images = await getImagesPayload();

  const response = await sendMessage({
    action: 'RUN_CONTENT_ACTION',
    flowUrl: flowUrlInput.value.trim(),
    payload: {
      type: 'TEST_UPLOAD',
      images
    }
  });

  if (response?.ok) {
    setStatus('Upload test command sent.');
    addLog(`Upload test command sent with ${images.length} image(s).`, 'OK');
  } else {
    setStatus(`Upload test failed: ${response?.error || 'Unknown error'}`);
    addLog(`Upload test failed: ${response?.error || 'Unknown error'}`, 'ERR');
  }
});

btnGenerate.addEventListener('click', async () => {
  setStatus('Testing generate click...');
  const response = await sendMessage({
    action: 'RUN_CONTENT_ACTION',
    flowUrl: flowUrlInput.value.trim(),
    payload: {
      type: 'TEST_GENERATE'
    }
  });

  if (response?.ok) {
    setStatus('Generate test command sent.');
    addLog('Generate test command sent.', 'OK');
  } else {
    setStatus(`Generate test failed: ${response?.error || 'Unknown error'}`);
    addLog(`Generate test failed: ${response?.error || 'Unknown error'}`, 'ERR');
  }
});

btnRunFull.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();

  if (!selectedFiles.length) {
    setStatus('Please select at least 1 image.');
    addLog('Run Full failed: no images selected.', 'ERR');
    return;
  }

  setStatus('Preparing full run...');
  const images = await getImagesPayload();

  const response = await sendMessage({
    action: 'RUN_CONTENT_ACTION',
    flowUrl: flowUrlInput.value.trim(),
    payload: {
      type: 'RUN_FULL',
      images,
      prompt
    }
  });

  if (response?.ok) {
    setStatus('Full run command sent.');
    addLog(`Full run command sent with ${images.length} image(s).`, 'OK');
  } else {
    setStatus(`Full run failed: ${response?.error || 'Unknown error'}`);
    addLog(`Full run failed: ${response?.error || 'Unknown error'}`, 'ERR');
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.source !== 'content-log') return;

  addLog(message.message, message.level || 'INFO');
});