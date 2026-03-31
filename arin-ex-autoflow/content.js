(() => {
  if (window.__ARIN_FLOW_V4_LOADED__) {
    console.log("[ArinFlowV4] content.js already loaded");
    return;
  }
  window.__ARIN_FLOW_V4_LOADED__ = true;

  function log(message, level = "INFO", extra) {
    const text = `[ArinFlowV4][${level}] ${message}`;
    console.log(text, extra || "");
    try {
      chrome.runtime.sendMessage({
        source: "content-log",
        level,
        message: extra ? `${message} | ${safeJson(extra)}` : message,
      });
    } catch (_) {}
  }

  function safeJson(v) {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      parseFloat(style.opacity || "1") > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function getRect(el) {
    return el?.getBoundingClientRect?.() || null;
  }

  function getText(el) {
    if (!el) return "";
    return [
      el.innerText || "",
      el.textContent || "",
      el.getAttribute?.("aria-label") || "",
      el.getAttribute?.("title") || "",
      el.getAttribute?.("placeholder") || "",
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function getRawText(el) {
    if (!el) return "";
    return [
      el.innerText || "",
      el.textContent || "",
      el.getAttribute?.("aria-label") || "",
      el.getAttribute?.("title") || "",
      el.getAttribute?.("placeholder") || "",
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getIconText(el) {
    if (!el) return "";
    const icon = el.querySelector("i, .google-symbols");
    return (icon?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  async function waitForCondition(checkFn, label, timeoutMs = 15000, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const result = checkFn();
        if (result) {
          log(`wait ok: ${label}`, "OK");
          return result;
        }
      } catch (_) {}
      await sleep(intervalMs);
    }
    throw new Error(`Timeout waiting for: ${label}`);
  }

  function highlightElement(el, label = "TARGET", color = "#22c55e") {
    if (!el || !isVisible(el)) return;
    const rect = el.getBoundingClientRect();

    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.border = `2px solid ${color}`;
    box.style.background = "rgba(34,197,94,0.08)";
    box.style.zIndex = "2147483647";
    box.style.pointerEvents = "none";
    box.style.borderRadius = "8px";
    box.style.boxSizing = "border-box";

    const badge = document.createElement("div");
    badge.textContent = label;
    badge.style.position = "absolute";
    badge.style.top = "-20px";
    badge.style.left = "0";
    badge.style.background = color;
    badge.style.color = "#fff";
    badge.style.fontSize = "11px";
    badge.style.lineHeight = "1";
    badge.style.padding = "4px 6px";
    badge.style.borderRadius = "6px";
    badge.style.fontWeight = "700";

    box.appendChild(badge);
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1200);
  }

  function dataURLtoFile(dataUrl, filename, mimeType = "image/png") {
    const arr = dataUrl.split(",");
    const mime = mimeType || arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  function distanceScore(a, b) {
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    return Math.hypot(ax - bx, ay - by);
  }

  function clickLikeHuman(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    try { el.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent("mousedown", opts)); } catch (_) {}
    try { el.dispatchEvent(new PointerEvent("pointerup", opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent("mouseup", opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent("click", opts)); } catch (_) {}
  }

  async function waitForPageReady() {
    await waitForCondition(
      () => document.readyState === "interactive" || document.readyState === "complete",
      "document ready",
      15000,
      200
    );
    await sleep(700);
  }

  // =========================
  // prompt / composer detection
  // =========================
  function getPromptCandidates() {
    const selectors = [
      '[contenteditable="true"]',
      '[role="textbox"]',
      'div[aria-multiline="true"]',
      "textarea",
      'input[type="text"]',
      "input:not([type])",
    ];

    const all = selectors.flatMap((s) => Array.from(document.querySelectorAll(s)));

    return Array.from(new Set(all))
      .filter(isVisible)
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top > window.innerHeight * 0.50 && rect.width > 120 && rect.height > 14;
      });
  }

  function scorePrompt(el) {
    const rect = el.getBoundingClientRect();
    const text = getText(el);
    const role = (el.getAttribute("role") || "").toLowerCase();
    const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    const tag = el.tagName.toLowerCase();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const ce = el.getAttribute("contenteditable") === "true";

    let score = 0;

    if (ce) score += 80;
    if (role === "textbox") score += 60;
    if (el.getAttribute("aria-multiline") === "true") score += 18;
    if (tag === "textarea") score += 45;
    if (tag === "input") score += 20;

    if (placeholder.includes("prompt")) score += 20;
    if (aria.includes("prompt")) score += 20;
    if (aria.includes("ข้อความ")) score += 10;
    if (text.includes("คุณต้องการสร้างอะไร")) score += 10;
    if (text.includes("prompt")) score += 8;

    if (rect.width > 260) score += 10;
    if (rect.height > 18) score += 6;

    if (centerY > window.innerHeight * 0.62) score += 26;
    if (centerY > window.innerHeight * 0.72) score += 12;
    if (centerX > window.innerWidth * 0.15 && centerX < window.innerWidth * 0.85) score += 10;

    let depth = 0;
    let node = el;
    while (node?.parentElement) {
      depth++;
      node = node.parentElement;
    }
    score += Math.min(depth, 20);

    return score;
  }

  function findPromptInput() {
    const candidates = getPromptCandidates()
      .map((el) => ({
        el,
        score: scorePrompt(el),
        rect: el.getBoundingClientRect(),
        text: getText(el),
        role: (el.getAttribute("role") || "").toLowerCase(),
        ce: el.getAttribute("contenteditable") === "true",
        tag: el.tagName.toLowerCase(),
      }))
      .sort((a, b) => b.score - a.score);

    if (candidates.length) {
      log(
        "Prompt candidates: " +
          candidates
            .slice(0, 6)
            .map(
              (x) =>
                `${x.tag} ce=${x.ce} role=${x.role} score=${x.score} text="${x.text.slice(
                  0,
                  40
                )}" rect=(${Math.round(x.rect.left)},${Math.round(x.rect.top)},${Math.round(
                  x.rect.width
                )},${Math.round(x.rect.height)})`
            )
            .join(" | ")
      );
    }

    let chosen = candidates[0]?.el || null;
    if (!chosen) return null;

    if (!chosen.matches?.('[contenteditable="true"],[role="textbox"],textarea,input')) {
      const inner = chosen.querySelector?.('[contenteditable="true"],[role="textbox"],textarea,input');
      if (inner && isVisible(inner)) chosen = inner;
    }

    if (!chosen.matches?.('[contenteditable="true"],[role="textbox"],textarea,input')) {
      const parent = chosen.parentElement;
      const alt = parent?.querySelector?.('[contenteditable="true"],[role="textbox"],textarea,input');
      if (alt && isVisible(alt)) chosen = alt;
    }

    return chosen;
  }

  function findComposerRoot() {
    const prompt = findPromptInput();
    if (!prompt) return null;

    let node = prompt;
    for (let i = 0; i < 10 && node; i++) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 420 && rect.height > 60 && rect.top > window.innerHeight * 0.55) {
        return node;
      }
      node = node.parentElement;
    }

    return prompt.parentElement || prompt;
  }

  // =========================
  // plus / upload / generate
  // =========================
  function findPlusButtonNearComposer() {
    const root = findComposerRoot();
    if (!root) return null;
    const rootRect = root.getBoundingClientRect();

    const buttons = [...document.querySelectorAll("button,[role='button']")].filter(isVisible);

    const scored = buttons
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = getText(el);
        const icon = getIconText(el);
        let score = 0;

        if (text.includes("add_2")) score += 80;
        if (icon === "add_2") score += 80;
        if (text === "+" || text.includes("เพิ่ม") || text.includes("add")) score += 30;
        if (rect.top > window.innerHeight * 0.62) score += 18;
        if (rect.left < window.innerWidth * 0.40) score += 12;

        const dist = distanceScore(rect, rootRect);
        if (dist < 220) score += 30;
        if (dist < 120) score += 20;

        return { el, score, rect, text, icon };
      })
      .sort((a, b) => b.score - a.score);

    log(
      "Plus candidates: " +
        scored
          .slice(0, 4)
          .map(
            (x) =>
              `"${x.text.slice(0, 30)}" icon="${x.icon}" score=${x.score} rect=(${Math.round(
                x.rect.left
              )},${Math.round(x.rect.top)},${Math.round(x.rect.width)},${Math.round(x.rect.height)})`
          )
          .join(" | ")
    );

    return scored[0]?.el || null;
  }

  function findUploadButtonInOpenPanel() {
    const buttons = [...document.querySelectorAll("button,[role='button']")].filter(isVisible);

    const scored = buttons
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = getText(el);
        const icon = getIconText(el);
        let score = 0;

        if (text.includes("upload")) score += 60;
        if (text.includes("อัปโหลด")) score += 60;
        if (text.includes("อัปโหลดรูปภาพ")) score += 40;
        if (icon.includes("upload")) score += 70;

        if (rect.top > window.innerHeight * 0.45) score += 10;
        if (rect.left < window.innerWidth * 0.75) score += 8;

        return { el, score, rect, text, icon };
      })
      .sort((a, b) => b.score - a.score);

    log(
      "Upload candidates: " +
        scored
          .slice(0, 4)
          .map(
            (x) =>
              `"${x.text.slice(0, 50)}" icon="${x.icon}" score=${x.score} rect=(${Math.round(
                x.rect.left
              )},${Math.round(x.rect.top)},${Math.round(x.rect.width)},${Math.round(x.rect.height)})`
          )
          .join(" | ")
    );

    return scored[0]?.el || null;
  }

  function findGenerateButton() {
    const buttons = [...document.querySelectorAll("button,[role='button']")].filter(isVisible);

    const scored = buttons
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = getText(el);
        const icon = getIconText(el);
        let score = 0;

        if (icon.includes("arrow_forward")) score += 100;
        if (text.includes("arrow_forward")) score += 70;
        if (text.includes("สร้าง")) score += 35;
        if (text.includes("generate")) score += 15;

        if (rect.top > window.innerHeight * 0.62) score += 18;
        if (rect.left > window.innerWidth * 0.55) score += 18;

        if (el.hasAttribute("disabled")) score -= 20;
        if (el.getAttribute("aria-disabled") === "true") score -= 20;

        return { el, score, rect, text, icon };
      })
      .sort((a, b) => b.score - a.score);

    log(
      "Generate candidates: " +
        scored
          .slice(0, 4)
          .map(
            (x) =>
              `"${x.text.slice(0, 40)}" icon="${x.icon}" score=${x.score} disabled=${
                x.el.disabled || x.el.getAttribute("aria-disabled") === "true"
              } rect=(${Math.round(x.rect.left)},${Math.round(x.rect.top)},${Math.round(
                x.rect.width
              )},${Math.round(x.rect.height)})`
          )
          .join(" | ")
    );

    return scored[0]?.el || null;
  }

  // =========================
  // prompt fill
  // =========================
  function setNativeInputValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : null;

    const setter = proto ? Object.getOwnPropertyDescriptor(proto, "value")?.set : null;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  function fireInputSequence(el, insertedText = "") {
    try {
      el.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: insertedText,
        })
      );
    } catch (_) {
      el.dispatchEvent(new Event("beforeinput", { bubbles: true, cancelable: true }));
    }

    try {
      el.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: insertedText,
        })
      );
    } catch (_) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function selectAllContentEditable(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function placeCaretAtEnd(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function fillPrompt(prompt) {
  const inputEl = await waitForCondition(findPromptInput, "prompt input", 15000, 250);

  highlightElement(inputEl, "PROMPT", "#22c55e");
  inputEl.focus();
  clickLikeHuman(inputEl);
  await sleep(120);

  const tag = inputEl.tagName.toLowerCase();
  const isCE =
    inputEl.getAttribute("contenteditable") === "true" ||
    inputEl.getAttribute("role") === "textbox";

  log(
    `Filling prompt safely. tag=${tag} ce=${isCE} text="${(getRawText(inputEl) || "").slice(0, 60)}"`
  );

  if (tag === "textarea" || tag === "input") {
    setNativeInputValue(inputEl, prompt);
    fireInputSequence(inputEl, prompt);
    inputEl.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
    inputEl.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
    await sleep(200);

    const afterText = (inputEl.value || "").trim();
    log(`Prompt filled. after="${afterText.slice(0, 120)}"`, "OK");

    if (!afterText) {
      throw new Error("Prompt fill failed: input value empty");
    }
    return;
  }

  if (!isCE) {
    throw new Error("Prompt fill failed: target is not editable");
  }

  // clear แบบเบา ๆ ไม่แก้ DOM ตรง
  try {
    inputEl.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
  } catch (_) {}

  await sleep(80);

  // พยายาม insertText ก่อน
  let inserted = false;
  try {
    inserted = document.execCommand("insertText", false, prompt);
  } catch (_) {
    inserted = false;
  }

  await sleep(120);

  let afterText = (inputEl.innerText || inputEl.textContent || "").trim();

  // fallback: ใช้ beforeinput/input โดยไม่แตะ textContent ตรง ๆ
  if (!afterText || afterText !== prompt) {
    try {
      inputEl.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: prompt,
        })
      );
    } catch (_) {}

    // ใช้ Selection + insertText แทน insertNode/textContent
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("insertText", false, prompt);
    } catch (_) {}

    try {
      inputEl.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: prompt,
        })
      );
    } catch (_) {
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // ยิง key event ให้ framework sync
  inputEl.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
  inputEl.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
  inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(150);
  inputEl.dispatchEvent(new Event("blur", { bubbles: true }));
  await sleep(120);
  inputEl.focus();

  afterText = (inputEl.innerText || inputEl.textContent || "").trim();
  log(`Prompt filled. after="${afterText.slice(0, 120)}"`, "OK");

  if (!afterText || afterText === "คุณต้องการสร้างอะไร") {
    throw new Error("Prompt fill failed: editor still looks empty/placeholder");
  }
}

  // =========================
  // upload verification
  // =========================
  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_\-.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getPanelRoot() {
    const candidates = [...document.querySelectorAll("div,[role='dialog']")]
      .filter(isVisible)
      .map((el) => ({ el, text: getText(el), rect: getRect(el) }))
      .filter((x) => x.rect && x.rect.width > 180 && x.rect.height > 120)
      .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);

    const byText = candidates.find((x) =>
      /(upload|อัปโหลด|image|รูปภาพ|photo)/i.test(x.text)
    );

    return byText?.el || candidates[0]?.el || null;
  }

  function findBestFileInput(panelRoot = null) {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    const composer = findComposerRoot();
    const panel = panelRoot || getPanelRoot();

    const scored = inputs
      .map((el) => {
        const rect = getRect(el) || { left: 0, top: 0, width: 0, height: 0 };
        let score = 0;
        const accept = (el.accept || "").toLowerCase();

        if (accept.includes("image")) score += 80;
        if (el.multiple) score += 15;
        if (!isVisible(el)) score += 8;

        if (panel) {
          try {
            const d = distanceScore(rect, panel.getBoundingClientRect());
            if (d < 350) score += 25;
            if (d < 220) score += 15;
          } catch (_) {}
        }

        if (composer) {
          try {
            const d = distanceScore(rect, composer.getBoundingClientRect());
            if (d < 500) score += 10;
          } catch (_) {}
        }

        return { el, score, accept, multiple: el.multiple, rect };
      })
      .sort((a, b) => b.score - a.score);

    log(
      "File input candidates: " +
        scored
          .slice(0, 4)
          .map(
            (x) =>
              `accept="${x.accept}" multiple=${x.multiple} score=${x.score} rect=(${Math.round(
                x.rect.left || 0
              )},${Math.round(x.rect.top || 0)},${Math.round(x.rect.width || 0)},${Math.round(
                x.rect.height || 0
              )})`
          )
          .join(" | ")
    );

    return scored[0]?.el || null;
  }

  function findVisibleFailureNode() {
    const failWords = [
      "ล้มเหลว",
      "failed",
      "error",
      "ไม่สำเร็จ",
      "อัปโหลดไม่สำเร็จ",
      "upload failed",
      "warning",
    ];

    const nodes = [...document.querySelectorAll("div,span,p,button")]
      .filter(isVisible)
      .map((el) => ({ el, text: getText(el), raw: getRawText(el), rect: getRect(el) }))
      .filter((x) => x.rect && x.rect.top > window.innerHeight * 0.35);

    return nodes.find((x) => failWords.some((w) => x.text.includes(w)))?.el || null;
  }

  function findFilenameNode(name) {
    const normalized = normalizeName(name);
    if (!normalized) return null;

    const nodes = [...document.querySelectorAll("div,span,p,button")]
      .filter(isVisible)
      .map((el) => ({ el, raw: getRawText(el), rect: getRect(el) }))
      .filter((x) => x.rect && x.rect.top > window.innerHeight * 0.30);

    return nodes.find((x) => {
      const t = normalizeName(x.raw);
      return t && (t.includes(normalized) || normalized.includes(t));
    })?.el || null;
  }

  function getComposerAttachmentSnapshot() {
    const root = findComposerRoot();
    if (!root) return [];

    const rr = root.getBoundingClientRect();

    return [...document.querySelectorAll("img,button,div,span")]
      .filter(isVisible)
      .map((el) => ({ el, text: getRawText(el), icon: getIconText(el), rect: getRect(el) }))
      .filter((x) => {
        const r = x.rect;
        if (!r) return false;
        return (
          r.bottom >= rr.top - 80 &&
          r.top <= rr.bottom + 100 &&
          r.left >= rr.left - 80 &&
          r.right <= rr.right + 220
        );
      })
      .filter((x) => {
        const text = normalizeName(x.text);
        return (
          x.el.tagName.toLowerCase() === "img" ||
          /\.(jpg|jpeg|png|webp)$/i.test(x.text) ||
          text.includes("image") ||
          x.icon.includes("image") ||
          x.icon.includes("close") ||
          x.icon.includes("delete")
        );
      })
      .map((x) => `${x.el.tagName}:${normalizeName(x.text)}:${x.icon}`);
  }

  function snapshotDiffCount(before, after) {
    const set = new Set(before);
    return after.filter((x) => !set.has(x)).length;
  }

  async function waitForUploadResult(fileName, beforeSnapshot, timeoutMs = 20000) {
    const start = Date.now();
    let seenName = false;
    let lastDiff = 0;

    while (Date.now() - start < timeoutMs) {
      const failNode = findVisibleFailureNode();
      if (failNode) {
        highlightElement(failNode, "UPLOAD FAIL", "#ef4444");
        throw new Error(`Upload failed: ${getRawText(failNode).slice(0, 160)}`);
      }

      const nameNode = findFilenameNode(fileName);
      if (nameNode) {
        seenName = true;
      }

      const afterSnapshot = getComposerAttachmentSnapshot();
      lastDiff = snapshotDiffCount(beforeSnapshot, afterSnapshot);

      if (lastDiff > 0) {
        log(`Composer attachment diff detected: +${lastDiff}`, "OK");
        return { ok: true, mode: "composer-diff", diff: lastDiff };
      }

      if (seenName && Date.now() - start > 3500) {
        log(`Filename "${fileName}" appeared on page; assuming upload accepted`, "OK");
        return { ok: true, mode: "filename-seen", diff: lastDiff };
      }

      await sleep(400);
    }

    log(`No explicit fail detected for "${fileName}" within timeout`, "WARN");
    return { ok: true, mode: "timeout-no-fail", diff: lastDiff };
  }

  async function uploadOneImage(item, index, total) {
    const file = dataURLtoFile(
      item.dataUrl,
      item.name || `image-${index + 1}.png`,
      item.type || "image/png"
    );

    const beforeSnapshot = getComposerAttachmentSnapshot();
    log(`Composer snapshot before upload: ${beforeSnapshot.length}`);

    const plusBtn = await waitForCondition(findPlusButtonNearComposer, "plus button", 12000, 250);
    highlightElement(plusBtn, "PLUS", "#f59e0b");
    clickLikeHuman(plusBtn);
    log(`Clicked plus for image ${index + 1}/${total}`, "OK");
    await sleep(700);

    const uploadBtn = await waitForCondition(findUploadButtonInOpenPanel, "upload button", 8000, 200);
    highlightElement(uploadBtn, "UPLOAD", "#38bdf8");
    clickLikeHuman(uploadBtn);
    log("Clicked upload button in panel", "OK");
    await sleep(400);

    const panelRoot = getPanelRoot();
    if (panelRoot) {
      log("Panel root detected", "OK");
    }

    const fileInput = await waitForCondition(
      () => findBestFileInput(panelRoot),
      "best image file input",
      8000,
      250
    );

    const dt = new DataTransfer();
    dt.items.add(file);

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")?.set;
    if (setter) setter.call(fileInput, dt.files);
    else fileInput.files = dt.files;

    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    log(`File selected: ${file.name}`, "OK");

    const result = await waitForUploadResult(file.name, beforeSnapshot, 20000);
    log(`Upload result accepted for ${file.name} via ${result.mode}`, "OK", result);

    await sleep(900);
  }

  async function uploadImages(images) {
    if (!images?.length) {
      log("No images to upload", "WARN");
      return;
    }

    for (let i = 0; i < images.length; i++) {
      await uploadOneImage(images[i], i, images.length);
    }
  }

  // =========================
  // generate
  // =========================
  async function clickGenerate() {
  const btn = await waitForCondition(findGenerateButton, "generate button", 12000, 250);
  highlightElement(btn, "GENERATE", "#22c55e");

  await waitForCondition(() => {
    const fresh = findGenerateButton();
    if (!fresh) return false;

    const disabled =
      fresh.disabled || fresh.getAttribute("aria-disabled") === "true";

    return disabled ? false : fresh;
  }, "generate enabled", 8000, 250);

  const liveBtn = findGenerateButton();
  const disabled =
    liveBtn.disabled || liveBtn.getAttribute("aria-disabled") === "true";

  if (disabled) {
    throw new Error("Generate button still disabled after waiting");
  }

  clickLikeHuman(liveBtn);
  log("Clicked generate button", "OK");
  await sleep(1500);
}

  // =========================
  // actions
  // =========================
  async function testSelectors() {
    await waitForPageReady();

    const prompt = findPromptInput();
    const plus = findPlusButtonNearComposer();
    const generate = findGenerateButton();

    if (prompt) {
      highlightElement(prompt, "PROMPT");
      log("Prompt found", "OK");
    } else {
      log("Prompt not found", "ERR");
    }

    if (plus) {
      highlightElement(plus, "PLUS", "#f59e0b");
      log("Plus found", "OK");
    } else {
      log("Plus not found", "ERR");
    }

    if (generate) {
      highlightElement(generate, "GENERATE", "#22c55e");
      log("Generate found", "OK");
    } else {
      log("Generate not found", "ERR");
    }
  }

  async function testPrompt(prompt) {
    await waitForPageReady();
    await fillPrompt(prompt || "test prompt from ArinFlowV4");
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

  if (images?.length) {
    await uploadImages(images);
    await sleep(1000);
  }

  if (prompt) {
    await fillPrompt(prompt);
    await sleep(1000);
  }

  await clickGenerate();
  log("Run Full completed", "OK");
}

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        if (message.type === "PING") {
          sendResponse({ ok: true, message: "pong" });
          return;
        }

        if (message.type === "RUN_ACTION") {
          const payload = message.payload || {};
          log(`Received action: ${payload.type}`);

          if (payload.type === "TEST_SELECTORS") {
            await testSelectors();
            sendResponse({ ok: true });
            return;
          }

          if (payload.type === "TEST_PROMPT") {
            await testPrompt(payload.prompt);
            sendResponse({ ok: true });
            return;
          }

          if (payload.type === "TEST_UPLOAD") {
            await testUpload(payload.images);
            sendResponse({ ok: true });
            return;
          }

          if (payload.type === "TEST_GENERATE") {
            await testGenerate();
            sendResponse({ ok: true });
            return;
          }

          if (payload.type === "RUN_FULL") {
            await runFull(payload.images, payload.prompt);
            sendResponse({ ok: true });
            return;
          }

          sendResponse({ ok: false, error: "Unknown payload type" });
          return;
        }

        sendResponse({ ok: false, error: "Unknown message type" });
      } catch (error) {
        const msg = error?.message || String(error);
        log(msg, "ERR");
        sendResponse({ ok: false, error: msg });
      }
    })();

    return true;
  });

  log("content.js loaded.", "OK");
})();