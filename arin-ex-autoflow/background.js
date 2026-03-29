chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('sidePanel error:', error));

const FLOW_URL_PATTERNS = [
  'https://labs.google/fx/*',
  'https://flow.google/*',
  'https://*.google.com/*'
];

async function queryTabs() {
  return chrome.tabs.query({});
}

async function findFlowTabByUrl(flowUrl) {
  const tabs = await queryTabs();

  const normalized = (flowUrl || '').trim();

  if (normalized) {
    const exactMatch = tabs.find(tab => tab.url && tab.url.startsWith(normalized));
    if (exactMatch) return exactMatch;
  }

  const fallback = tabs.find(tab => {
    const url = tab.url || '';
    return url.includes('labs.google/fx') || url.includes('flow.google');
  });

  return fallback || null;
}

async function activateTab(tabId) {
  await chrome.tabs.update(tabId, { active: true });
}

async function openFlowTab(flowUrl) {
  const url = flowUrl && flowUrl.trim()
    ? flowUrl.trim()
    : 'https://labs.google/fx/tools/flow';

  const tab = await chrome.tabs.create({ url, active: true });
  return tab;
}

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      return true;
    }
    await sleep(700);
  }

  return false;
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureFlowTab(flowUrl) {
  let tab = await findFlowTabByUrl(flowUrl);

  if (!tab) {
    tab = await openFlowTab(flowUrl);
    await waitForTabComplete(tab.id);
    return tab;
  }

  await activateTab(tab.id);

  if (tab.status !== 'complete') {
    await waitForTabComplete(tab.id);
  }

  return tab;
}

async function ensureInjected(tabId) {
  const ping = await sendMessageToTab(tabId, { type: 'PING' });

  if (ping?.ok) {
    return { ok: true };
  }

  try {
    await injectContentScript(tabId);
    await sleep(600);

    const secondPing = await sendMessageToTab(tabId, { type: 'PING' });

    if (secondPing?.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      error: secondPing?.error || 'Ping after injection failed'
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error)
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'FIND_OR_OPEN_FLOW_TAB') {
        const tab = await ensureFlowTab(message.flowUrl);
        sendResponse({ ok: true, tabId: tab.id, url: tab.url });
        return;
      }

      if (message.action === 'INJECT_CONTENT') {
        const tab = await ensureFlowTab(message.flowUrl);
        const injectResult = await ensureInjected(tab.id);

        if (!injectResult.ok) {
          sendResponse(injectResult);
          return;
        }

        sendResponse({ ok: true, tabId: tab.id });
        return;
      }

      if (message.action === 'RUN_CONTENT_ACTION') {
        const tab = await ensureFlowTab(message.flowUrl);
        const injectResult = await ensureInjected(tab.id);

        if (!injectResult.ok) {
          sendResponse(injectResult);
          return;
        }

        const response = await sendMessageToTab(tab.id, {
          type: 'RUN_ACTION',
          payload: message.payload
        });

        sendResponse(response || { ok: false, error: 'No response from content script' });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown action' });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error?.message || String(error)
      });
    }
  })();

  return true;
});