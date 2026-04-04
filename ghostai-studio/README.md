# GhostAI Studio

## AI/TTS Policy

- Gemini, Groq, and OpenRouter are for script generation and text workflows only.
- Do not use Gemini TTS or Gemini audio-generation code for preview, narration, export, or playback.
- All spoken audio in this project must use Google Cloud TTS via `gh_api_tts`.
- If the app is reading a script aloud, route it through `lib/tts-engine.js` and the Google Cloud TTS endpoint.

โปรเจกต์นี้เป็นเว็บแบบ static + Vite สำหรับพัฒนาและ build ไฟล์ก่อนเอาขึ้นโฮสต์

## ติดตั้ง

```bash
npm install
```

## รันตอนพัฒนา

```bash
npm run dev
```

- ใช้สำหรับเปิด dev server
- script นี้จะ build CSS จาก `src/input.css` ก่อนรัน
- source ที่ใช้งานจริงมีชุดเดียวที่ root:
  - `lib/`
  - `styles/`
  - `output.css`

## Build

```bash
npm run build
```

ใช้เมื่อ:
- แก้โค้ด/แก้ CSS เสร็จแล้ว และต้องการอัปเดตไฟล์ใน `dist`
- ต้องการเตรียมไฟล์สำหรับ deploy ขึ้น shared hosting
- ต้องการเช็กเวอร์ชัน production ก่อนอัปโหลดจริง

คำสั่งนี้จะ:
- build CSS ใหม่
- build ไฟล์ production ด้วย Vite
- copy หน้า static HTML และ root `lib/`, `styles/`, `output.css` เข้า `dist`

ไม่จำเป็นต้องใช้ ถ้าแค่กำลังพัฒนาในเครื่อง เพราะกรณีนั้นใช้ `npm run dev` จะเหมาะกว่า

ผลลัพธ์จะอยู่ในโฟลเดอร์ [dist](c:\Users\NewIceLoki & TheGang\Desktop\Autogen_Ai\ghostai-studio\dist)

ไฟล์หลักที่ได้:
- `dist/index.html`
- `dist/feed.html`
- `dist/tarot.html`
- `dist/settings.html`
- `dist/lib/*`
- `dist/styles/*`
- `dist/output.css`

## Preview ไฟล์ที่ build แล้ว

```bash
npm run preview
```

## Deploy ขึ้น Shared Hosting

1. รัน `npm run build` บนเครื่องเรา
2. เปิดโฟลเดอร์ `dist`
3. อัปโหลดไฟล์ทั้งหมดใน `dist` ขึ้น shared hosting
4. ตั้งหน้าเริ่มต้นเป็น `index.html`

ไม่ต้องอัปโหลด:
- `node_modules`
- `src`
- `scripts`

## หมายเหตุ

- Shared hosting ไม่ต้องมี Node ถ้าเรา build มาก่อนแล้ว
- API key ตอนนี้เก็บใน `localStorage` ของ browser
- ถ้าจะซ่อน key จริง ควรย้ายไป backend ภายหลัง
- `public/` ควรใช้เก็บ static asset ที่ไม่มี source ซ้ำเท่านั้น เช่น favicon หรือ asset ภาพ
