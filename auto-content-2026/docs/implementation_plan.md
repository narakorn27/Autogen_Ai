# Auto Content 2026 — Chrome Extension Implementation Plan

สร้าง Chrome Extension ระบบครบวงจรสำหรับ **สร้างและโพสต์คอนเทนต์ Facebook อัตโนมัติ** ตั้งแต่ดึงข่าว → สร้างเนื้อหา AI → สร้างภาพ → ซ้อนข้อความ → โพสต์/ตั้งเวลา ทั้งหมดจาก Side Panel ของ Chrome

## User Review Required

> [!IMPORTANT]
> **API Keys ที่ต้องเตรียม:**
> - **Gemini API Key** — สำหรับ AI Text + Image generation
> - **TMDB API Key** — สำหรับดึงข้อมูลหนัง (ฟรีที่ themoviedb.org)
> - **Facebook Page Access Token** — สำหรับโพสต์ลง Facebook (ต้องมี `pages_manage_posts` permission)

> [!WARNING]
> - Google Trends ไม่มี Official API ต้องใช้ RSS Feed (อาจถูก rate limit)
> - Facebook Graph API ต้อง Long-lived Token หรือ System User Token ถึงจะใช้ได้นาน
> - Imagen 3/4 ต้องใช้ Vertex AI project (มีค่าใช้จ่าย) → ใช้ Gemini native image gen เป็นหลักก่อน

> [!CAUTION]
> โปรเจคนี้ใหญ่มาก (8+ modules) จะแบ่งการพัฒนาเป็น Phase ตามลำดับ ทำทีละ Phase เพื่อให้ทดสอบได้ทุกจุด

---

## Project Structure

```
auto-content-2026/
├── manifest.json            # MV3 Chrome Extension manifest
├── background.js            # Service Worker (alarms, scheduling, Facebook API)
├── sidepanel.html           # Side Panel UI (Dashboard)
├── sidepanel.css            # Styles (Dark theme, modern UI)
├── sidepanel.js             # Dashboard logic (Trends, Compose, Queue, Logs)
├── options.html             # Settings page (API keys, Pages, Models)
├── options.css              # Settings page styles
├── options.js               # Settings page logic
├── lib/
│   ├── trends.js            # Google Trends RSS fetcher
│   ├── tmdb.js              # TMDB API wrapper
│   ├── news-fetcher.js      # AI/Travel/Games news fetcher
│   ├── gemini-text.js       # Gemini text generation (Thai posts)
│   ├── gemini-image.js      # Gemini/Imagen image generation
│   ├── canvas-overlay.js    # Text overlay on images (Canvas API)
│   ├── facebook-api.js      # Facebook Graph API (post, schedule)
│   └── utils.js             # Shared utilities
├── fonts/
│   └── Prompt-*.woff2       # Google Fonts "Prompt" (bundled for Canvas)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Proposed Changes

### Component 1: Project Scaffolding

#### [NEW] [manifest.json](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/manifest.json)
MV3 manifest กำหนด:
- **permissions**: `storage`, `sidePanel`, `alarms`, `offscreen`, `notifications`
- **host_permissions**: `*://trends.google.com/*`, `*://api.themoviedb.org/*`, `*://graph.facebook.com/*`, `*://generativelanguage.googleapis.com/*`
- **side_panel**: `sidepanel.html`
- **options_page**: `options.html`
- **background**: service_worker `background.js`

---

### Component 2: Dashboard UI (Side Panel) — 4 Tabs

#### [NEW] [sidepanel.html](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/sidepanel.html)
#### [NEW] [sidepanel.css](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/sidepanel.css)
#### [NEW] [sidepanel.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/sidepanel.js)

4 แท็บหลัก:

| Tab | Icon | คำอธิบาย |
|-----|------|----------|
| **Trends** | 📡 | เลือกแหล่งข่าว, กรองหมวด, multi-select ข่าว |
| **Compose** | ✍️ | แก้ไขโพสต์ AI, สร้าง/แก้ภาพ, เลือกเพจ, โพสต์/ตั้งเวลา |
| **Queue** | 📋 | คิวโพสต์ที่ตั้งเวลาไว้ พร้อมสถานะ |
| **Log** | 📊 | Activity logs ทั้งหมด |

**Trends Tab:**
- Dropdown เลือก Content Source (Google Trends / TMDB / AI News / Travel / How-to / Games)
- Country picker (TH, US, GB, JP, SG)
- Category filter chips
- News list with checkboxes for multi-select
- "Generate Post" button → ส่งไป Compose Tab

**Compose Tab:**
- AI-generated post text (editable textarea)
- Tone selector (Formal / Casual / Sales)
- Page niche input
- "Regenerate" button
- Image section: AI-generated image preview + "Generate Image" / "Use TMDB Poster"
- Text overlay toggle + preview
- Page selector dropdown
- "Post Now" / "Schedule" buttons + datetime picker

**Queue Tab:**
- List of scheduled posts with: time, page, status (pending/posted/failed)
- Cancel/Edit buttons per item
- Auto-refresh

**Log Tab:**
- Timestamped activity entries (fetched, generated, posted, errors)
- Filter by type
- Clear logs button

**Analytics Widget (Sidebar/Top):**
- สรุปสถิติรายวัน (จำนวนโพสต์สำเร็จ/ล้มเหลว รวมทุกเพจ)
- ตรวจสอบสถานะ Token (แจ้งเตือนถ้าใกล้หมดอายุ)
- จำนวนเพจที่ Active อยู่ในระบบ

---

### Component 3: Content Fetching

#### [NEW] [lib/trends.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/lib/trends.js)
- ดึง Google Trends Daily/Realtime RSS feed
- รองรับ geo: TH, US, GB, JP, SG
- กรองตาม category (tech, business, entertainment, sports, etc.)
- Parse XML → JSON array `{ title, summary, source, url, image, publishedAt }`

#### [NEW] [lib/tmdb.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/lib/tmdb.js)
- Fetch now playing / upcoming movies from TMDB API v3
- Return `{ title, overview, posterUrl, releaseDate, voteAverage, genres }`
- Language: th-TH with en-US fallback

#### [NEW] [lib/news-fetcher.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/lib/news-fetcher.js)
- AI News: Google News RSS `q=artificial+intelligence` + Reddit `/r/artificial/hot.json`
- Travel: Google News RSS `q=travel+review` + Reddit `/r/travel`
- Games: Google News RSS `q=gaming+news` + Reddit `/r/gaming`
- How-to/Tips: Google News RSS `q=how+to+tips` + Reddit `/r/LifeProTips`
- Unified data format `{ title, summary, source, url, thumbnail, category }`

#### [NEW] [lib/evergreen-pool.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/lib/evergreen-pool.js)
- จัดการ **"Evergreen Content"** (คอนเทนต์ที่ไม่หมดอายุ เช่น คำคมสร้างแรงบันดาลใจ, เกร็ดความรู้)
- ใช้สำรองสลับโพสต์ในกรณีที่จับข่าว Trend ในรอบนั้นๆ ไม่เจอ เพื่อรักษา Engagement เพจ

---

### Component 4: AI Text Generation

#### [NEW] [lib/gemini-text.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/lib/gemini-text.js)
- ใช้ Gemini API สร้างโพสต์ Facebook ภาษาไทย
- Input: ข่าว(title+summary) + tone + niche
- System prompt สร้าง:
  - เนื้อหาโพสต์ (200-400 คำ)
  - Headline (สำหรับ overlay)
  - Keywords (สำหรับ highlight แดง)
  - Subline (ข้อมูลย่อย)
  - Hashtags (3-5 อัน)
- Output: JSON `{ postText, headline, keywords, subline, hashtags, imagePrompt }`
- รองรับโมเดล: gemini-2.0-flash, gemini-2.5-pro, etc.

---

### Component 5: AI Image Generation

#### [NEW] [lib/gemini-image.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/lib/gemini-image.js)
- **Gemini Native Image Gen** (`imagen-3.0-generate-002` via Gemini API)
- **Imagen 3/4** models: Standard, Ultra, Fast variants
- Parameters: aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9), size, count
- Style: Photorealistic, Cinematic (added to prompt automatically)
- Auto-generate image prompt from news headline
- Return base64 image data
- Fallback: ใช้ TMDB poster สำหรับเพจรีวิวหนัง

---

### Component 6: Text Overlay (Canvas)

#### [NEW] [lib/canvas-overlay.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/lib/canvas-overlay.js)
- ใช้ **OffscreenCanvas** หรือ `<canvas>` ใน sidepanel
- วางข้อความ Headline:
  - Keywords → สีแดง (`#FF3333`)
  - ข้อความทั่วไป → สีขาว (`#FFFFFF`)
  - ฟอนต์: **Prompt Bold** (Google Fonts, Thai support)
  - Emboss effect: drop shadow + text stroke
- Subline ใต้ headline:
  - ข้อความปกติ → สีขาว semi-transparent
  - `#hashtag` → สีแดง
- Dark gradient overlay ด้านล่างภาพ (readability)
- Auto text sizing ตาม canvas dimensions
- **Logo & Watermark**: โหลดไฟล์โลโก้เพจ (จาก Settings) มาวางมุมภาพอัตโนมัติ สร้างความจดจำแบรนด์
- Export เป็น JPEG/PNG blob

#### [NEW] [fonts/Prompt-Bold.woff2](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/fonts/)
- Bundle ฟอนต์ Prompt จาก Google Fonts (weight 700) สำหรับใช้กับ Canvas
- ต้องโหลดด้วย `FontFace` API

---

### Component 7: Facebook Auto Posting

#### [NEW] [lib/facebook-api.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/lib/facebook-api.js)
- **Post Now**: `POST /{page-id}/photos` with `message` + image (binary/url)
- **Schedule Post**: เก็บใน queue → `chrome.alarms` trigger ตามเวลา
- Multi-page support:
  - เก็บ config แต่ละเพจ `{ pageId, pageName, accessToken, contentSource, niche, maxPostsPerDay }`
  - เลือกเพจก่อนโพสต์
- ตรวจสอบ daily post limit per page
- Error handling: token expired, rate limit, post failed

---

### Component 8: Auto Run Loop

ใน **background.js** (Service Worker):
- `chrome.alarms` สำหรับจัดการ loop
- Toggle on/off เก็บใน `chrome.storage`
- Random interval: 3-5 ชั่วโมง (configurable)
- Loop flow: Fetch Trends → Generate Text → Generate Image → Overlay → Post
- **Instant Post Mode**: alarm ทุก 15 นาที, เช็คข่าวใหม่ที่ตรง category → โพสต์ทันที
- **Run Now**: trigger loop แบบ manual จาก sidepanel
- **Duplicate Prevention System**: ตรวจสอบ History ย้อนหลังว่าหัวข้อข่าวหรือ URL นี้ถูกเพจเราโพสต์ไปแล้วหรือยัง ป้องกันเนื้อหาซ้ำซ้อน
- Dedup: เก็บ `postedUrls[]` ป้องกันโพสต์ซ้ำ

---

### Component 9: Settings (Options Page)

#### [NEW] [options.html](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/options.html)
#### [NEW] [options.css](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/options.css)
#### [NEW] [options.js](file:///c:/Users/NewIceLoki%20&%20TheGang/Desktop/Autogen_Ai/auto-content-2026/options.js)

**Sections:**
1. **AI Settings** — Gemini API Key, text model, image model, filter chips (Flash/Pro/Experimental)
2. **TMDB Settings** — API Key, language preference
3. **Facebook Pages** — เพิ่ม/ลบ/แก้ไขเพจ (Page ID, Name, Token, Content Source, Niche, Max Posts/Day)
4. **Auto Run** — เปิด/ปิด auto-run, interval range, instant post toggle
5. **Content Preferences** — default country, categories, tone/style
6. **Import/Export** — backup/restore settings as JSON

---

## Data Architecture

```
chrome.storage.local:
├── settings
│   ├── geminiApiKey: string
│   ├── textModel: string (e.g., "gemini-2.0-flash")
│   ├── imageModel: string (e.g., "imagen-3.0-generate-002")
│   ├── tmdbApiKey: string
│   ├── defaultCountry: string
│   ├── defaultTone: string
│   └── defaultNiche: string
├── pages: [{ pageId, pageName, accessToken, contentSource, niche, maxPostsPerDay }]
├── autoRun
│   ├── enabled: boolean
│   ├── intervalMin: number (hours)
│   ├── intervalMax: number (hours)
│   ├── instantPost: boolean
│   └── lastRunAt: string (ISO)
├── queue: [{ id, pageId, postText, imageBlob, scheduledAt, status, createdAt }]
├── logs: [{ timestamp, type, message, pageId }]
└── postedUrls: [string] (dedup)
```

---

## Phased Development Plan

| Phase | ฟีเจอร์ | ไฟล์ที่สร้าง/แก้ |
|-------|---------|-----------------|
| **1** | Scaffolding + Base UI | manifest, html/css/js ทั้ง sidepanel + options |
| **2** | Content Fetching | lib/trends.js, lib/tmdb.js, lib/news-fetcher.js |
| **3** | AI Text Generation | lib/gemini-text.js |
| **4** | AI Image Generation | lib/gemini-image.js |
| **5** | Text Overlay | lib/canvas-overlay.js, fonts/ |
| **6** | Facebook Posting | lib/facebook-api.js, background.js scheduling |
| **7** | Auto Run Loop | background.js auto-run logic |
| **8** | Settings Page | options.html/css/js |
| **9** | Polish & Testing | ทุกไฟล์ |

---

## Verification Plan

### Manual Verification (ทดสอบทีละ Phase)

**Phase 1 — Load Extension:**
1. เปิด `chrome://extensions` → Developer mode → Load unpacked → เลือก `auto-content-2026/`
2. ตรวจสอบว่า Extension โหลดสำเร็จ ไม่มี error
3. คลิก icon → Side Panel เปิดได้ → เห็น 4 tabs
4. Right-click → Options → Settings page เปิดได้

**Phase 2 — Content Fetching:**
1. เลือก Source = "Google Trends" → Country = "TH" → กดดึงข่าว → เห็น list ข่าว
2. เลือก Source = "TMDB" → เห็นหนังใหม่พร้อมโปสเตอร์
3. เลือกข่าวหลายรายการ → กด "Generate Post" → สลับไป Compose Tab

**Phase 3 — AI Text:**
1. ใส่ Gemini API Key ใน Settings
2. ใน Compose Tab → เห็น AI-generated Thai post
3. เปลี่ยน Tone → กด Regenerate → เนื้อหาเปลี่ยนตาม

**Phase 4 — AI Image:**
1. กด "Generate Image" → เห็นภาพ AI สร้างขึ้น
2. เปลี่ยน aspect ratio → regenerate → ภาพเปลี่ยนสัดส่วน

**Phase 5 — Overlay:**
1. เปิด Text Overlay toggle → เห็น headline ซ้อนบนภาพ
2. Keywords แดง, text ขาว, subline + hashtag ถูกต้อง
3. ฟอนต์ Prompt อ่านภาษาไทยได้

**Phase 6 — Facebook Post:**
1. ใส่ Facebook Page Token ใน Settings
2. กด "Post Now" → โพสต์ไปยัง Facebook Page จริง (ทดสอบกับ Test Page)
3. กด "Schedule" → ตั้งเวลา → ดูใน Queue Tab → โพสต์ตามเวลา

**Phase 7 — Auto Run:**
1. เปิด Auto Run → ให้วนลูปสุ่มเวลา
2. เปิด Instant Post → รอ 15 นาที → ตรวจสอบว่าโพสต์อัตโนมัติ

**Phase 8 — Settings:**
1. เพิ่ม/ลบ Facebook Pages ได้
2. เปลี่ยน model → ตรวจสอบว่าใช้ model ที่เลือก
3. Export/Import settings สำเร็จ
