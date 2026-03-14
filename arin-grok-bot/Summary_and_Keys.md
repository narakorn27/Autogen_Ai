# 🚀 สรุปงาน Arin Auto Bot (Phase 1)
**Project Path:** `c:\Users\NewIceLoki & TheGang\Desktop\Autogen_Ai\arin-auto-bot\`

## ✅ สิ่งที่ทำเสร็จแล้ว
1. **Side Panel UI** 
   - แบ่งหมวดหมู่ Control (จัดการคิวงาน) และ Setting (ตั้งค่า)
   - ธีม Dark Mode ตกแต่งไฟ Neon Green ให้ดูล้ำสมัย
2. **ระบบ Queue & Delay** 
   - สามารถพิมพ์ Prompt ทีละหลายรูป
   - มีระบบหน่วงเวลา (Random Delay) ก่อนกดส่ง เพื่อให้ปลอดภัยขึ้น
3. **Multi AI Integration** 
   - เพิ่มระบบกด `✨ AI Edit (Preview)` เพื่อพรรณนา Prompt ให้เป็นระดับมือโปร
   - รองรับ AI 3 แบรนด์: Gemini, Groq, OpenRouter
4. **Google Flow "Human" Automation**
   - **Click Automation**: บอทจะกดคลิกให้เหมือนคน (มี Delay, มีการลากเมาส์)
   - **Settings Automation**: กดเปิดเมนู ตั้งสัดส่วน (Ratio), จำนวน (Output Count), และโมเดลที่ต้องการอัตโนมัติ (เพิ่มรองรับ `Nano Banana 2`, `Nano Banana Pro` และ `Imagen 4` แล้ว)
5. **Auto Download** 
   - ตรวจจับวิดีโอ/รูปภาพที่เสร็จแล้ว เซฟลงใน Folder ย่อยและเปลี่ยนชื่อไฟล์อัตโนมัติ

---

## ⏳ แผนงานต่อไป (Next Steps)
1. **โหมด Frame to Video**:
   - ปรับสคริปต์ `content.js` ให้ลากไฟล์รูปที่เราเตรียมไว้ (Upload Image) ไปหยอดในเว็บไซต์ของ Google ได้สมบูรณ์
2. **ระบบกู้คืนเมื่อ Error**:
   - จัดการตอนเว็บ Google ค้าง ล่ม หรือคิวเต็มขีดจำกัดรายวัน ให้บอทค้างคิวงานไว้ และค่อยๆ เริ่มรันต่อเมื่อพร้อม

---

## 🔑 Backup API Keys

*ห้ามเปิดเผยข้อมูลส่วนนี้ เพราะเป็นคีย์ใช้สำหรับเชื่อมต่อ AI เสียค่าใช้จ่าย*

### 1. OpenRouter
(ใช้สำหรับโมเดลภาษาหลากหลาย เช่น Llama, Mistral)
**Key:** 
`New : sk-or-v1-25ae0b5f7ea3de47ad012c038eabc74ce4d9ca80b72729abc5a7f50d4f73207aNew`
- URL ตรวจเช็ค: https://openrouter.ai/

### 2. Groq (Fast Inference)
(เน้นความเร็ว ตอบโต้ไว)
**Key:** 
`New: gsk_oXF9uTp60UP915HXnc3qWGdyb3FYPMlU7wPXmCH75dU5CGTa8VmmNew`
- URL ตรวจเช็ค: https://console.groq.com/keys



Arin Auto Bot — Phase 1: Google Flow Mastery
Chrome Extension (Manifest V3) สำหรับ Auto Gen Video/Image บน Google Flow
แสดงเป็น Side Panel ด้านขวาของเบราว์เซอร์ (เหมือน VEO Automation)
UI ภาษาไทย · Dark Mode · Neon Green Accent

UI Design Reference
Arin Auto Bot — Sidebar UI Mockup

🏗️ โครงสร้างไฟล์
ที่: c:\Users\NewIceLoki & TheGang\Desktop\Autogen_Ai\arin-auto-bot\

arin-auto-bot/
├── manifest.json       ← Manifest V3 + sidePanel config
├── sidepanel.html      ← UI หลัก (แทน popup — แสดงเป็น sidebar)
├── sidepanel.css       ← Dark mode theme
├── sidepanel.js        ← Event listeners + state management
├── background.js       ← Service Worker (queue, delay, download)
├── content.js          ← DOM manipulator สำหรับ Google Flow
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
NOTE

เปลี่ยนจาก popup.* เป็น sidepanel.* เพื่อใช้ Chrome Side Panel API — extension จะแสดงเป็น sidebar ด้านขวาเหมือน VEO Automation ในภาพตัวอย่าง

Proposed Changes
Core Config
[MODIFY] 
manifest.json
manifest_version: 3
Permissions: storage, activeTab, scripting, downloads, sidePanel
Host permissions: *://labs.google/fx/*
side_panel: { "default_path": "sidepanel.html" }
Service Worker: background.js
Content Scripts: [NEW] ลงทะเบียน content.js ให้รันที่ *://labs.google/fx/*
Icons: 16, 48, 128 px
คลิกไอคอน extension → เปิด Side Panel ทาง chrome.sidePanel.open()
UI Layer (Side Panel)
[NEW] 
sidepanel.html
Header: โลโก้ "🤖 Arin Auto Bot" + badge v1.0

TAB 1: Control — หน้าสั่งงานหลัก (ทุก label ภาษาไทย)

Section	Elements
1.1 เลือกโหมด	3 ปุ่ม: Text to Video (default active เขียว) · Frame to Video · Text to Image
1.2 ตั้งค่าความเร็ว	Dropdown จำนวนคิวพร้อมกัน (1-4) · Input หน่วงเวลาสุ่ม (min ⇄ max วินาที)
1.3 อัปโหลดรูป	แสดงเฉพาะ Frame to Video — กล่อง Drag & Drop + Dropdown ตัวเลือกการประมวลผลภาพ
1.4 คำสั่ง (Prompts)	Textarea (1 prompt/บรรทัด) · ปุ่ม อัปโหลดไฟล์ .txt · Toggle AI ช่วยแต่ง Prompt
1.5 ผลลัพธ์และจัดเก็บ	Dropdown จำนวนผลลัพธ์ต่อ Prompt (1-4) · Input บันทึกลงโฟลเดอร์ · คำแนะนำ (เปลี่ยนตามโหมด) · Toggle เปลี่ยนชื่อไฟล์อัตโนมัติ
1.6 คิวงาน	Header คิวงาน — 0 กำลังทำงาน · รายการคิว (แสดงสถานะ + ข้อความแสดงข้อผิดพลาดถ้ามี) · ปุ่ม ↺ ล้าง (เทา) + ▷ เริ่มรัน (เขียว)
TAB 2: ตั้งค่า — บันทึกใน chrome.storage.local

Section	Elements
⚙️ ตั้งค่า Google Flow	สัดส่วนภาพ (16:9, 9:16, 1:1, 4:3) · ความยาววิดีโอ (5s, 10s) · โมเดลภาพ (Imagen 3, Imagen 3 Fast)
🤖 ตั้งค่า AI	Gemini API Key (type=password) · สไตล์เริ่มต้น (Cinematic, Anime, Photorealistic, 3D Render)
[NEW] 
sidepanel.css
Token	ค่า
BG	#0d0d1a
Card BG	#1a1a2e
Accent	#00ff88
Text	#e0e0e0
Muted	#666
Font	Inter (Google Fonts)
Border radius	12px
Glassmorphism cards + backdrop-filter: blur()
Mode buttons: transition + active glow เขียว
Toggle switch: CSS custom (เขียว on / เทา off)
Upload zone: border: 2px dashed #333, hover เปลี่ยนเขียว
Smooth transition: all 0.3s ease
[NEW] 
sidepanel.js
สลับ Tab (Control ↔ ตั้งค่า)
สลับ Mode → show/hide Upload Zone + เปลี่ยนคำแนะนำ
Load/Save ทุก input จาก chrome.storage.local
File handler (Drag & drop images + upload .txt)
ปุ่ม เริ่มรัน → parse prompts → ส่ง queue ไป background.js
ปุ่ม ล้าง → clear queue + textarea
อัปเดต Queue UI แบบ real-time
AI Enhance toggle (placeholder — เรียก Gemini API ผ่าน fetch)
Background + Content Script
[NEW] 
background.js
Queue Manager — FIFO, concurrent ตาม concurrentPrompts
Random Delay — Math.random() * (max - min) + min วินาที
ส่งคำสั่ง → chrome.tabs.sendMessage() ไปที่ content.js
Auto Download → chrome.downloads.download() ลง subfolder
สั่งเปิด Side Panel เมื่อคลิกไอคอน extension
Broadcast status กลับไปที่ sidepanel
[NEW] 
content.js
รับคำสั่งจาก background.js
Text to Video / Image — ใช้ระบบ Multi-selector (คุณต้องการสร้างอะไร / What do you want to create) → จำลองการพิมพ์แบบสมบูรณ์ (keydown/input/keyup) → ค้นหาปุ่มกดด้วย Proximity search (ค้นหาจาก Parent) → กด Generate
Frame to Video — inject image → กรอก prompt → กด Generate
Helpers: sleep(), findFirstVisibleElement(), findGenerateButton(), typeText()
ส่ง success/fail + ข้อความ Error (ถ้าหาปุ่ม/ช่องไม่เจอ) กลับ background
IMPORTANT

CSS Selectors ของ Google Flow ใช้แบบ placeholder → ต้อง Inspect Element บนเว็บจริงแล้วปรับทีหลัง

Extension Icons
[NEW] icons/ (icon16.png, icon48.png, icon128.png)
Generate โลโก้ Arin Bot สีเขียวนีออนบนพื้นดำ
💾 Data Schema
js
const botState = {
  control: {
    activeMode: "text_to_video",
    concurrentPrompts: 2,
    delayMin: 20, delayMax: 30,
    uploadedImages: [],
    imageProcessingOption: "first_frame",
    promptsText: "",
    outputsPerPrompt: 2,
    saveFolder: "veo-folder-1",
    autoRename: true,
    aiEnhance: false
  },
  settings: {
    aspectRatio: "16:9",
    duration: "5s",
    imageModel: "imagen_3",
    apiKey: "",
    defaultVibe: "cinematic"
  },
  queue: []   // [{ id, prompt, status, mode }]
}
🚀 Workflow
Google Flow
content.js
background.js
sidepanel.js
User
Google Flow
content.js
background.js
sidepanel.js
User
เลือก Mode, พิมพ์ Prompt, กด เริ่มรัน
sendMessage({ action: "startQueue", prompts, settings })
Queue Manager + Random Delay
sendMessage({ action: "generate", prompt, mode })
querySelector → กรอก Prompt → click Generate
ผลลัพธ์พร้อม
sendMessage({ status: "done", resultUrl })
chrome.downloads.download(resultUrl)
อัปเดตสถานะคิว
Advanced Features Detail
1. Settings Application (content.js)
ก่อนเริ่มพิมพ์ Prompt บอทจะทำการตั้งค่าโหมดและตัวเลือกต่างๆ ให้ตรงกับที่ผู้ใช้เลือกใน Sidebar:

Open Menu: ค้นหาปุ่มสรุปการตั้งค่า (มักมี ID ขึ้นต้นด้วย radix- และแสดงค่าสรุปโมเดล/สัดส่วน) แล้วคลิกเพื่อเปิดเมนู
Category Selection: คลิกเลือก รูปภาพ (Image) หรือ วิดีโอ (Video) ตามโหมด text_to_image vs อื่นๆ
Ratio Selection: คลิกเลือกสัดส่วนภาพ เช่น แนวนอน (Landscape), แนวตั้ง (Portrait), จัตุรัส (Square)
Output Count: คลิกเลือก x1, x2, x3, หรือ x4 ตามค่า outputsPerPrompt
Model Selection:
คลิกที่กล่องเลือกโมเดล (Dropdown)
ค้นหาและคลิกโมเดลที่ต้องการ (เช่น Imagen 3, Imagen 3 Fast, หรือโมเดลวิดีโออย่าง Nano Banana 2)
ใช้การเทียบ Text แบบยืดหยุ่น (Fuzzy match) เพื่อความแม่นยำ
2. Auto Download (content.js + background.js)
เมื่อ Gen เสร็จ บอทจะมองหาปุ่ม "Download" ใน Result Container
เมื่อคลิกดาวน์โหลด background.js จะดักจับ onDeterminingFilename เพื่อ:
เปลี่ยนชื่อไฟล์ตาม Prompt (ถ้าเลือกไว้)
ย้ายเข้าโฟลเดอร์ย่อยที่กำหนด
3. Frame to Video (content.js)
บอทจะมองหาปุ่ม "Upload" หรือ "Add Image"
จัดการสร้าง File object (ถ้าเป็นไปได้) หรือจำลองการ Drag & Drop ไฟล์เข้าหน้าเว็บ
4. AI Enhance & Preview (background.js + Multi-Provider support)
Multi-Provider Hub: Support both Google Gemini and Groq (Llama 3).
Groq Integration:
Endpoint: https://api.groq.com/openai/v1/chat/completions
Models: llama-3.3-70b-versatile (balanced) or llama3-70b-8192.
Free Quota: High throughput, ideal as a fallback for Gemini Free tier.
Restoration: พัฒนา System Prompt ให้กลับมาเป็นระดับ "Professional Prompt Engineer" (ขยาย Prompt เป็นภาษาอังกฤษที่ละเอียดมาก)
Preview Tool: เพิ่มปุ่ม ✨ AI Edit (Preview) ใน Sidebar เพื่อให้ผู้ใช้กดแก้ Prompt ล่าสุดให้กลายเป็น Prompt สถาปัตย์ JSON-style หรือแบบพรรณนาละเอียดได้ก่อนรัน
API Status: เพิ่มตัวบ่งชี้สถานะ (Spinning/Check/Error) สำหรับ Gemini/Groq API Key ในหน้า Setting
✅ Verification Plan
โหลด Extension — chrome://extensions/ → Developer Mode → Load unpacked → เลือก arin-auto-bot
ตรวจ API Status — กรอก API Key ในหน้า Setting → กดปุ่ม Check (หรือรอดูสถานะ) → ต้องแสดงเครื่องหมายถูกสีเขียวถ้าใช้งานได้
ตรวจ AI Enhance Preview — พิมพ์ "แมวสีฟ้าน่ารัก" → กด ✨ AI Edit (Preview) → ข้อความต้องเปลี่ยนเป็นภาษาอังกฤษที่ยาวและละเอียด
Queue Flow — ลองรันงานในคิวแบบเปิด AI Enhance → ตรวจสอบ log ใน Background สันนิษฐานว่าทำงานถูกต้อง

