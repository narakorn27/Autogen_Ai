# GhostAI Studio

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
- script นี้จะ build CSS และ sync ไฟล์ `lib/styles` ให้อัตโนมัติก่อนรัน

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
- sync ไฟล์ `lib` และ `styles`
- build ไฟล์ production ด้วย Vite
- copy หน้า `feed.html`, `settings.html`, `tarot.html` เข้า `dist`

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
