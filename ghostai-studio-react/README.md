# GhostAI Studio React

โปรเจคนี้คือเวอร์ชัน React ใหม่ของ `ghostai-studio` โดยสร้างแยกไว้ใน `ghostai-studio-react` เพื่อไม่กระทบไฟล์เดิม

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
- `/#/tarot` = Spirit Tarot
- `/#/ouija` = Ouija Board
- `/#/story-ritual` = Personalized Ritual
- `/#/settings` = Settings
- `/#/dev-tools` = เครื่องมือทดสอบภายใน

## เอกสารสำหรับเริ่มอ่าน

อ่าน `REACT_GUIDE_TH.md` ก่อน ถ้ายังไม่คุ้น React + TypeScript  
อ่าน `MIGRATION_PLAN.md` ถ้าจะเริ่มย้าย logic จากโปรเจคเก่าเข้ามา
