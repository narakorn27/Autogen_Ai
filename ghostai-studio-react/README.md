# GhostAI Studio React

โปรเจคนี้คือเวอร์ชัน React ใหม่ของ `ghostai-studio` โดยสร้างแยกไว้ใน `ghostai-studio-react` เพื่อไม่กระทบไฟล์เดิม

KE GHOST AI EVENLAB : New_sk_dd6bda5d3383fd4263b10e474bd631f48fbfdc8b82a7ab66 

## คำสั่งที่ใช้บ่อย

```bash
npm install
npm run dev
npm run build
npm run preview
```

- `npm run dev` ใช้เปิดเว็บตอนพัฒนา
- `npm run build` ใช้สร้างไฟล์ static ใน `dist/` สำหรับเอาไป deploy
- `npm run preview` ใช้ดู build production ในเครื่อง

ถ้าใช้ PowerShell แล้วเจอข้อความว่า `npm.ps1 cannot be loaded because running scripts is disabled` ให้ใช้คำสั่งแบบนี้แทน:

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run preview
```

หมายเหตุ: `package.json` ของโปรเจคนี้เรียก `vite` และ `tsc` ผ่าน `node ./node_modules/...` เพื่อเลี่ยงปัญหา path บน Windows ที่ชื่อโฟลเดอร์มีสัญลักษณ์พิเศษ เช่น `&`

## โครงหลักที่ต้องจำ

- `src/main.tsx` คือจุดเริ่ม React
- `src/App.tsx` คือจุดใส่ router ของแอป
- `src/routes.tsx` คือรายการหน้าและ URL
- `src/components/layout/` คือ layout กลาง เช่น sidebar และ topbar
- `src/pages/` คือหน้าหลักแต่ละหน้า
- `src/services/` คือ logic กลางสำหรับเรียก API, localStorage, license
- `src/hooks/` คือ state หรือ behavior ที่ใช้ซ้ำหลายหน้า
- `src/config/navigation.ts` คือจุดเดียวสำหรับแก้เมนู

## Routing

โปรเจคนี้ใช้ Hash Router เพื่อให้ deploy บน shared hosting ง่าย:

- `/#/` = AI Studio
- `/#/feed` = The Ghost Radio
- `/#/spirit-box` = Spirit Box EVP
- `/#/tarot` = Spirit Tarot
- `/#/ouija` = Ouija Board
- `/#/story-ritual` = Personalized Ritual
- `/#/settings` = Settings
- `/#/dev-tools` = เครื่องมือทดสอบภายใน

## สถานะฟีเจอร์ที่ทดสอบได้ตอนนี้

- `Settings` บันทึก key และทดสอบ `Gemini`, `Groq`, `OpenRouter`, `Google Cloud TTS`
- `Feed` ดึง RSS/mock และทำ workflow เลือกคลิป -> summary -> Ghost Rewrite -> copy/TTS
- `AI Studio` สร้างสคริปต์จาก keyword, metadata, voice card picker แบบ legacy, realtime Audio FX panel, export `.txt`, raw `.mp3`, export with FX `.wav`, thumbnail canvas export และ TTS Haunted FX preview
- `Spirit Box` ถามตอบวิญญาณแบบ EVP พร้อม oscilloscope และ TTS Haunted FX
- `Personalized Ritual` สร้างเรื่องเฉพาะบุคคลและลองพากย์ TTS
- `Spirit Tarot` สุ่มไพ่ ตีความด้วย AI/fallback มี frequency interference canvas, copy/export และ TTS
- `Ouija Board` ถามตอบวิญญาณด้วย board, planchette animation, board path และ session log
- `Dev Tools` ทดสอบ split text, TTS, stop, export mp3 และ Haunted FX preview

## เอกสารสำหรับเริ่มอ่าน

อ่าน `REACT_GUIDE_TH.md` ก่อน ถ้ายังไม่คุ้น React + TypeScript  
อ่าน `MIGRATION_PLAN.md` ถ้าจะเริ่มย้าย logic จากโปรเจคเก่าเข้ามา
