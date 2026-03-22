# Auto Content 2026 — Chrome Extension Task List

## Phase 0: Planning & Setup
- [/] Explore existing workspace & understand patterns
- [/] Create comprehensive implementation plan
- [ ] Get user approval on plan

## Phase 1: Project Scaffolding
- [ ] Create `auto-content-2026/` directory
- [ ] Create `manifest.json` (MV3, side_panel, alarms, storage, offscreen)
- [ ] Create base file structure (background.js, sidepanel.html/css/js, options.html/css/js)
- [ ] Setup Google Fonts (Prompt — Thai support)
- [ ] Create icons

## Phase 2: Dashboard UI (Side Panel)
- [ ] **Trends Tab** — news list, filters, multi-select
- [ ] **Compose Tab** — post editor, image preview, post/schedule buttons
- [ ] **Queue Tab** — scheduled posts list with status
- [ ] **Logs Tab** — activity log viewer
- [ ] **Analytics Widget** — Daily post success rate, token health, active pages count
- [ ] Tab navigation system

## Phase 3: Content Fetching
- [ ] Google Trends fetcher (multi-country: TH/US/GB/JP/SG, category filter)
- [ ] TMDB movie fetcher (new releases + posters)
- [ ] AI News fetcher (Google News RSS + Reddit)
- [ ] Travel content fetcher
- [ ] How-to / Tips fetcher
- [ ] Games news fetcher (Google News RSS + Reddit)
- [ ] **Evergreen Content Pool** — Fetch generic timeless content (quotes, facts) when no new trends are available

## Phase 4: AI Content Generation (Gemini)
- [ ] Gemini API integration for text generation
- [ ] Thai Facebook post generation from selected news
- [ ] Tone/style selection (Formal, Casual, Sales/Marketing)
- [ ] Niche/page-theme customization

## Phase 5: AI Image Generation
- [ ] Gemini native image generation
- [ ] Imagen 3/4 integration (Standard, Ultra, Fast)
- [ ] Aspect ratio options (1:1, 3:4, 4:3, 9:16, 16:9)
- [ ] Size options (1K/2K) & count
- [ ] Style presets (Photorealistic, Cinematic)
- [ ] Auto prompt generation for images
- [ ] TMDB poster support for movie review pages

## Phase 6: Text Overlay on Images
- [ ] Canvas-based text overlay system
- [ ] Headline rendering (keywords in red, text in white)
- [ ] Subline rendering with #hashtag in red
- [ ] Google Fonts "Prompt" (Thai) integration
- [ ] Emboss effect + outline styling
- [ ] **Logo & Watermark System** — Upload page logo to overlay at the corner of generated images

## Phase 7: Facebook Auto Posting
- [ ] Facebook Graph API integration (post with image)
- [ ] Post Now functionality
- [ ] Schedule Post (queue system)
- [ ] Multi-page support (separate Page ID, Token, Content Source, Niche)
- [ ] Max posts per day per page limit

## Phase 8: Auto Run Loop
- [ ] Auto-run toggle (on/off)
- [ ] Random interval loop (e.g., 3-5 hours)
- [ ] Instant Post (RSS poll every 15 min, auto-post if match)
- [ ] Manual "Run Now" button
- [ ] **Duplicate Prevention System** — Check content URLs/titles against history to avoid spam

## Phase 9: Settings (Options Page)
- [ ] Gemini API Key management
- [ ] Text/Image model selection with chip filter (Flash/Pro/Experimental)
- [ ] TMDB API Key for movie reviews
- [ ] Facebook Pages manager (unlimited pages)
- [ ] Import/Export settings

## Phase 10: Verification & Polish
- [ ] Manual testing of each feature flow
- [ ] Error handling & edge cases
- [ ] CSS polish & animations
- [ ] Final walkthrough
