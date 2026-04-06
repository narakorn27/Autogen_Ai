# แผนย้าย GhostAI Studio เดิมมา React

## เป้าหมาย

- ไม่แก้ `ghostai-studio` เดิมในช่วง scaffold
- ใช้ `ghostai-studio-react` เป็นโปรเจคใหม่
- ย้ายทีละหน้าเพื่อให้ rollback ง่าย
- ทำเอกสารภาษาไทยให้คนที่ยังไม่คุ้น React อ่านตามได้

## Backup

ตอนแรกมีการสร้าง source-only backup ไว้ที่:

```text
ghostai-studio-legacy-backup/
```

backup นี้ไม่รวม:

- `node_modules`
- `dist`

แต่โปรเจคใหม่ยังทำงานแยกจาก `ghostai-studio` เดิมอยู่ดี จึงไม่ต้องพึ่ง backup ในขั้น scaffold

## ลำดับการย้ายหน้า

1. `SettingsPage` เพราะ logic ชัดและใช้ localStorage เป็นหลัก
2. `FeedPage` เพราะมี feed service และ mock fallback
3. `TarotPage` เพราะใช้ TTS และ spiritual UI
4. `StoryRitualPage` เพราะเป็นหน้าเฉพาะทาง
5. `OuijaPage` เพราะมี interaction เยอะ
6. `StudioPage` เพราะของเดิมใน `index.html` ใหญ่ที่สุด

## หลักการย้าย logic

- HTML structure ย้ายไป `pages/` หรือ `components/`
- script inline ย้ายไป `services/` หรือ `features/<ชื่อหน้า>/`
- localStorage ย้ายไป `settingsStorage.ts`
- API calls ย้ายไป service เฉพาะทาง
- UI ที่ซ้ำกันย้ายไป `components/common/`

## License

รอบนี้ยังไม่มี backend จริง ให้เตรียม service กลางไว้ก่อน:

- `licenseService.ts`
- `useLicenseGate.ts`
- `types/license.ts`

ในอนาคตสามารถเลือกได้ว่าจะเช็ก license จากไฟล์บน shared hosting หรือ endpoint แยก

## เกณฑ์จบ scaffold รอบแรก

- `npm run dev` เปิดได้
- `npm run build` ผ่าน
- hash route เปิดได้ครบ
- sidebar/topbar มาจาก component กลาง
- เอกสารไทยครบ 3 ไฟล์
