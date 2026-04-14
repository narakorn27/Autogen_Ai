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

## สถานะหลังย้ายรอบล่าสุด

- `SettingsPage` ใช้ localStorage และทดสอบ API ได้จริงผ่าน `aiService.ts`
- `FeedPage` ดึง RSS/mock ได้ และมี Ghost Rewrite + TTS เบื้องต้นจากชื่อคลิป
- `StudioPage` สร้างสคริปต์เรื่องผีจาก keyword และส่งเข้า TTS ได้
- `StoryRitualPage` สร้าง personalized horror story และส่งเข้า TTS ได้
- `TarotPage` สุ่มไพ่ ตีความด้วย AI/fallback มี frequency interference canvas, copy/export และส่งเข้า TTS ได้
- `OuijaPage` ถามตอบวิญญาณด้วย AI/fallback มี React board, planchette animation, board path และ session log ได้
- `DevToolsPage` ทดสอบ split text, Google Cloud TTS, stop, export mp3 และ Haunted FX preview ได้

## สถานะ phase ปัจจุบัน

- Phase 0: scaffold React + Vite + TypeScript เสร็จแล้ว และ `npm run build` ผ่าน
- Phase 1: Settings migration เสร็จระดับใช้งานจริงแล้ว แต่ UI ยังไม่ clone จาก legacy ทุก pixel
- Phase 2: Feed migration เสร็จระดับ flow หลักแล้ว มี RSS/mock, Ghost Rewrite และ TTS เบื้องต้น
- Phase 3: TTS service migration เสร็จระดับใช้งานร่วมกันได้แล้ว โดยเปลี่ยนเป็น MP3 chunk, เพิ่ม stop/download helper, rate/pitch, Haunted FX preview, WAV export with FX, dialogue chunk mode และ DevTools สำหรับทดสอบเสียง แต่ยังไม่ใช่ mixer/crossfade/SSML เต็มจาก `tts-engine.js`
- Phase 4: Tarot / Story Ritual / Ouija / Studio migration เสร็จระดับ route + core flow แล้ว
- Phase 5: visual parity เริ่มแล้ว โดยเพิ่ม Tarot frequency interference/copy/export, Ouija board + planchette animation + session log, Story Ritual layout, Feed pipeline panel, Studio controls/metadata/export, thumbnail canvas export และ TTS export mp3 เพิ่มเติม แต่ยังต้องเก็บรายละเอียด audio FX/export เฉพาะทางจาก legacy ต่อ

สรุปคือรอบนี้เข้าสู่ช่วง `visual parity + feature parity` แล้ว ไม่ใช่ช่วง scaffold แล้ว ถ้าจะทำต่อให้เหมือนของเก่า ควรย้ายทีละหน้าโดยเริ่มจาก `FeedPage` หรือ `StudioPage` เพราะเป็นหน้าที่ผู้ใช้แตะบ่อยสุด

## สิ่งที่ยังไม่เท่ากับ legacy 100%

- Ouija ย้ายเป็น React board พร้อม planchette animation และ session log แล้ว แต่ยังไม่ได้ clone effect เฉพาะทางทุกจุดจาก `ouija-board.js`
- TTS รอบนี้รองรับ MP3 raw export, WAV export with FX, voice, rate, pitch, dialogue chunk mode และ Haunted FX preview แล้ว แต่ยังไม่ได้ย้าย mixer/crossfade/SSML render แบบ legacy 1:1
- Studio ย้าย metadata generator, export `.txt`, export `.mp3`, voice controls และ thumbnail canvas export ระดับเบื้องต้นแล้ว แต่ยังไม่ได้ย้ายเครื่องมือ export ทั้งหมดจาก legacy
- Feed ย้าย content pipeline เบื้องต้นแล้ว แต่ยังไม่มี transcript จริงจากเสียงคลิป เพราะยังไม่มี backend/transcript endpoint ในรอบนี้
- Tarot มี frequency interference canvas, signal lock, copy/export และ TTS แล้ว แต่ยังไม่ได้ clone animation เฉพาะทางทุกจุดจาก legacy

## Audit เทียบระบบ legacy กับ React

- `index.html` -> `StudioPage.tsx`: ย้าย core story/metadata/TTS/export/thumbnail แล้ว แต่ยังไม่ครบทุก tool ย่อยจากหน้าเดิม
- `feed.html` -> `FeedPage.tsx`: ย้าย feed + pipeline แล้ว แต่ transcript จากเสียงคลิปยังไม่มี เพราะต้องมี API/backend เพิ่ม
- `settings.html` -> `SettingsPage.tsx`: ย้าย localStorage/API test หลักแล้ว
- `tarot.html` + `lib/spirit-tarot.js` -> `TarotPage.tsx`: ย้าย flow หลัก + visualizer ใหม่แล้ว แต่ยังไม่ clone effect legacy ทุกจุด
- `ouija.html` + `lib/ouija-board.js` -> `OuijaPage.tsx`: ย้าย board/planchette/session log แล้ว แต่ logic infer board/spell/path แบบ legacy ยังไม่ครบทุก edge case
- `story-ritual.html` + `lib/story-ritual.js` -> `StoryRitualPage.tsx`: ย้าย personalized story/TTS/layout แล้ว แต่ typewriter/flash/share flow ยังไม่ครบเท่าของเดิม
- `tts-api-test.html` + `tts-diagnostic.html` -> `DevToolsPage.tsx`: ย้าย diagnostic หลักแล้ว และเพิ่ม mp3 export/Haunted FX preview
- `lib/story-gen.js` -> `aiService.ts`: ย้าย generate/request/test API, cleanup/dedupe/enforce duration และ mock story fallback ระดับหลักแล้ว
- `lib/tts-engine.js` -> `ttsService.ts`: ย้าย voice/chunk/TTS/play/export/dialogue chunk ระดับหลักแล้ว แต่ยังไม่ครบ SSML/mix/crossfade render เต็ม
- Voice picker ของหน้า index เดิม -> `TtsVoicePicker.tsx`: ย้ายเป็น card list แบบเลือกเสียง/preview ได้แล้ว พร้อม voice list Chirp 3 HD ชุดเดียวกับ legacy และปรับ spacing ไม่ให้ถูกบีบใน layout หลัก
- Metadata tags ของหน้า index เดิม -> `StudioPage.tsx`: ย้ายจาก textarea ดิบเป็น tag chips แบบ legacy พร้อม input แก้ไขและปุ่ม copy tags
- Audio FX dashboard ของหน้า index เดิม -> `AudioFxPanel.tsx`: ย้าย UI play/export/raw/image + toggles Reverb/Pitch Low/Whisper/Static/Main Volume แล้ว และ `Export with FX` render เป็น WAV ผ่าน OfflineAudioContext ได้
- `lib/audio-processor.js`: ย้ายแกน preview/export FX เบื้องต้นแล้ว แต่ยังไม่ครบทุก algorithm/ambient asset/master chain แบบ legacy 1:1
- `lib/visualizer.js`: ย้ายแนวคิดเป็น `OscilloscopeCanvas.tsx` แล้ว และใช้ใน `SpiritBoxPage`; Tarot ยังมี canvas interference เฉพาะทางของตัวเอง
- `lib/ghost-overlay.js`: ย้าย idle whisper + jumpscare overlay เข้า `GhostOverlay.tsx` แล้ว
- `lib/spirit-box.js`: ย้ายเป็นหน้า `SpiritBoxPage.tsx` พร้อม route `/spirit-box`, oscilloscope และ TTS Haunted FX แล้ว

## สถานะล่าสุดหลังรอบปิดงาน engine

- `aiService.ts`: เพิ่ม cleanup/dedupe/enforce duration จากแนว `story-gen.js` เดิมแล้ว โดยสคริปต์ที่ AI สร้างจะถูกจัด `<break>`, ตัดประโยคซ้ำ, ตัดท้ายวนซ้ำ และคุมจำนวนคำตาม duration ก่อนส่งกลับหน้า Studio
- `ttsService.ts`: เพิ่ม dialogue chunk mode แล้ว ถ้าเปิด dialogue mode และมี secondary voice ระบบจะแบ่งตามบรรทัดและสลับเสียงหลัก/เสียงรองตอน synthesize
- `StudioPage.tsx`: เพิ่มตัวเลือก dialogue mode + secondary voice, เพิ่มปุ่มเจน thumbnail ใหม่ด้วย seed-based canvas background และยัง export `.png` ได้โดยไม่พึ่งรูป external ที่เสี่ยงติด CORS
- `AudioFxPanel.tsx` + `ttsService.ts`: `Export with FX` render เป็น `.wav` ผ่าน `OfflineAudioContext` แล้ว ไม่ใช่ปุ่ม placeholder
- Build ล่าสุดผ่านด้วย `npm.cmd run build`

## สิ่งที่เหลือแบบไม่สามารถเรียกว่า static clone 100%

- Transcript จากเสียง YouTube ยังต้องมี backend หรือ transcript API ภายนอก เพราะ browser static app ไม่ควร/ไม่สามารถทำงานถอดเสียงคลิปยาวจาก YouTube ได้ครบเองแบบปลอดภัย
- License จริงยังเป็น service stub ถ้าจะปล่อยเช่า ต้องตัดสินใจว่าจะใช้ไฟล์ license บน shared hosting หรือ license endpoint แยก
- ความเหมือน pixel-by-pixel กับ legacy ยังอาจไม่ 100% ในบาง animation เฉพาะทาง แต่ระบบหลักของ React ตอนนี้มีตัวแทนครบทุกหน้าและ engine หลักถูกย้ายเข้ามาแล้ว
