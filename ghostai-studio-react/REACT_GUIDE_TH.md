# คู่มือ React + Vite + TypeScript สำหรับ GhostAI Studio

เอกสารนี้เขียนสำหรับคนที่คุ้นกับ `HTML`, `PHP`, `JavaScript`, `CSS` มาก่อน และเพิ่งเริ่มใช้ React

## ภาพรวมการทำงาน

```text
ผู้ใช้เปิดเว็บ
-> index.html
-> src/main.tsx
-> src/App.tsx
-> src/routes.tsx
-> src/components/layout/AppShell.tsx
-> src/pages/หน้าที่เลือก
```

ถ้าเทียบกับเว็บ HTML เดิม:

- `index.html` ไม่ได้ใส่เนื้อหาทั้งเว็บแล้ว แต่เป็นจุดให้ React เข้าไปวาด UI
- `main.tsx` เหมือนสวิตช์เปิด React
- `routes.tsx` เหมือนตัวเลือกว่าจะโหลดหน้าไหน
- `AppShell.tsx` เหมือน template กลางที่มี header/sidebar
- `pages/*.tsx` เหมือน HTML แต่ละหน้า

## Component คืออะไร

Component คือชิ้นส่วน UI ที่เอาไปใช้ซ้ำได้ เช่น `Sidebar`, `Topbar`, `PageHeader`, `StatusBadge`, `AudioPlayer`

ไฟล์ component มักขึ้นต้นด้วยตัวใหญ่ เช่น `Sidebar.tsx`

## Props คืออะไร

Props คือข้อมูลที่ส่งเข้า component เช่นส่งชื่อหน้าเข้า `PageHeader`

```tsx
<PageHeader title="The Ghost Radio" description="ฟีดคลื่นหลอนจาก YouTube" />
```

ถ้าจะแก้ข้อความของ component ที่ถูกเรียกซ้ำ ให้ดูว่าข้อความถูกส่งผ่าน props หรือมาจาก config

## State คืออะไร

State คือข้อมูลที่เปลี่ยนได้ระหว่างใช้งาน เช่น กำลังโหลด feed, license ผ่านไหม, API key ถูก save หรือยัง, TTS กำลังเล่นไหม

ถ้า state ถูกใช้หลายหน้า ให้แยกไปอยู่ใน `hooks/` หรือ `services/`

## Hook คืออะไร

Hook คือ function พิเศษของ React ที่ช่วยจัดการ state หรือ behavior เช่น:

- `useAppSettings()` อ่าน/เขียน setting กลาง
- `useLicenseGate()` ตรวจสิทธิ์ license
- `useTtsPlayback()` เก็บสถานะเสียงกำลังเล่น

ชื่อ hook จะขึ้นต้นด้วย `use`

## Service คืออะไร

Service คือไฟล์ logic กลางที่ไม่ควรผูกกับ UI โดยตรง เช่น:

- `feedService.ts` ดึงและ parse RSS
- `settingsStorage.ts` อ่าน/เขียน localStorage
- `aiService.ts` เตรียมไว้สำหรับเรียก AI provider
- `ttsService.ts` เตรียมไว้สำหรับ TTS
- `licenseService.ts` เตรียมไว้สำหรับ license check

ถ้า logic เดิมอยู่ใน `<script>` ของ HTML ให้ย้ายมาที่ `services/` ก่อน แล้วค่อยให้ page/component เรียกใช้

## Type คืออะไร

Type คือการบอก TypeScript ว่าข้อมูลหน้าตาเป็นอย่างไร เช่น:

```ts
export type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  thumbnail: string;
  source: "youtube" | "mock";
};
```

ข้อดีคือช่วยกันพิมพ์ผิดและช่วยให้ editor แนะนำ field ได้

## ถ้าจะแก้อะไร ต้องไปไฟล์ไหน

- เพิ่มเมนู: `src/config/navigation.ts`
- แก้ sidebar: `src/components/layout/Sidebar.tsx`
- แก้ topbar: `src/components/layout/Topbar.tsx`
- แก้หน้า Feed: `src/pages/FeedPage.tsx`
- แก้ logic ดึง feed: `src/services/feedService.ts`
- แก้ localStorage setting: `src/services/settingsStorage.ts`
- แก้ theme CSS: `src/styles/globals.css`
- เพิ่ม type กลาง: `src/types/`

## กติกาการเขียนในโปรเจคนี้

- ถ้า UI ใช้ซ้ำ ให้สร้าง component ใน `components/`
- ถ้า logic ใช้ซ้ำ ให้สร้าง service ใน `services/`
- ถ้า state ใช้ซ้ำ ให้สร้าง hook ใน `hooks/`
- ถ้าเป็นหน้าหลัก ให้ใส่ใน `pages/`
- อย่าเขียน sidebar/header ซ้ำในทุกหน้า ให้ใช้ `AppShell`
- comment ภาษาไทยให้ใส่เฉพาะจุดที่ช่วยเข้าใจ flow จริงๆ
