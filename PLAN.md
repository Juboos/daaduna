# Daaduna (ضادُنا): Build Plan

Status: **approved 2026-11-08 with all defaults in section 7.** We adjust as we go.
Date: 2026-11-08

### Build status (2026-11-08)
- **Phase 1a, 1b and 1c are built and run locally** (`npm run dev`). Storage is browser-only (`LocalBackend`, with IndexedDB for recordings and sheets). Emails go to Admin → Email outbox.
- Lesson UI after review: lessons are a scrolling page of focused sections, with **Read** and **Narrated** (step-by-step) modes. The palette is lapis and saffron, with light and dark themes.
- Placeholder Arabic audio is generated with the macOS voice Majed (`scripts/gen-audio.ts`). Your recordings go in `content/audio/ar/<text>.m4a` and replace the placeholders.
- **Next:** connect Supabase (Auth, Postgres, Storage) and Resend through a `SupabaseBackend` with the same interface; then Phase 2.

### Change after review: concrete nouns first
Function words (في، ما، بين، أنْ) are frequent but make poor first reading words. Reading sets now draw from a **hand-picked core vocabulary of concrete, picturable nouns first** (بَيْت، باب، بِنْت، تِين …). Words from the frequency list follow, and function words only appear when a sentence needs them.
- Many good beginner nouns are **not in Al-Said** (تُفّاحة، قَلَم، كَلْب، قَمَر، بِنْت). The core vocabulary is our own list in `content/vocab/core.yaml`. Where a word is also in Al-Said, its frequency rank is attached.
- Al-Said's "Common noun" tag does not separate concrete from abstract (رَئيس، عَمَل). Each word gets a `concrete` flag (drafted by me, checked by you).
- Readability is unchanged: a word is readable once every letter and printed mark is taught.
- **Ordering inside a reading set:** core concrete nouns → concrete nouns from the frequency list → other content words → function words (only as needed for phrases and sentences).
- The Unit 1 core vocabulary (ا ب ت ث ن ي only) includes بَيْت، باب، أب، ابْن، بِنْت، تِين، ناب، نَبات, plus أنا and أنْتَ/أنْتِ for the phrase bank.

---

## 0. What exists today

- The repo (`~/Desktop/Daaduna`) is empty. It is not a git repository yet.
- I found `AlSaid_2023_MSA_Common_Words_1000.xlsx` in `~/Downloads` and inspected it. It has three sheets: `About`, `Word List` (1,250 voweled forms over 1,000 ranks) and `PoS tags`.
  - Columns: rank, form #, voweled word as printed, bare word, PoS tag, PoS meaning, frequency, % of corpus A/B, note, article page.
  - **No English glosses and no transliteration.** We have to add both.
  - **About 320 forms are only partly voweled** (for example `معلُومات`, `عَلى`, `هَذا` with no dagger alif), and 84 forms have no marks at all (`في`, `أب`, `جديد`).
  - **Three entries contain tatweel and brackets:** `لـ(ه)`, `بـ(ه)`, `وَحْدَ(ه)`. These break the "no tatweel in answers" rule, so they need cleaning.
  - **The readability rule works.** I applied "every letter and every printed mark is taught" to Unit 1 (ا أ ب ت ث ن ي + fatha, damma, kasra, sukun). It returns exactly **14 forms**: أنْ، أنا، أنْتَ، أنْتِ، يا، أيْ، بَيْن، أيْنَ، ابْن، أب، يأتي، بَيْت، باب، بَيان. That matches your "14 of the top 1000". Adding Unit 2 (ل م ك ف ق + shadda) gives 96 ranks (132 forms), close to your 100. I'll check the remaining gap once the Unit 2 lesson order is fixed.

---

## 1. Architecture

### 1.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 19 + Vite + TypeScript** | You know it. It's a client-heavy app (canvas, audio, animation), so it doesn't need SSR. |
| App shell | **PWA** (installable, full-screen on iPad and phone) | One codebase for phone, tablet and desktop. Offline mode comes later on the same service worker. Capacitor can wrap it for app stores later if needed. |
| Routing / state | React Router, TanStack Query (server data), Zustand (lesson player state) | Small and well known. |
| Styling | Tailwind CSS v4 with **logical properties only** (`ms-`, `pe-`, `start-`, `end-`), CSS variables for theme | Logical properties keep RTL correct. Dark mode and font size come from tokens. |
| Animation | SVG + `motion` (Framer Motion) for slides and stroke drawing. Rive or Lottie for the character cast later. | Stroke animations have to be driven by data (stroke paths), and code-driven SVG handles that well. |
| Ink / tracing | Pointer Events + `perfect-freehand` for ink rendering, custom stroke checker | Handles finger and Apple Pencil, with pressure and a pen-only (palm rejection) mode. |
| Audio | HTMLAudio / Web Audio. `MediaRecorder` for recording. Waveform and pitch drawn client-side. | No server processing needed. |
| Backend | **Supabase**: Postgres, Auth, Storage, Row-Level Security, Edge Functions | Free tier at launch. Relational data fits progress, review queues and roots well. RLS enforces the student/tutor/admin roles in the database. |
| Email | **Resend** (custom SMTP for Supabase Auth, plus notification emails) | Supabase's built-in email is limited to a few messages an hour. Resend's free tier is 3,000 a month. |
| Hosting | **Cloudflare Pages** | Free, unlimited bandwidth, commercial use allowed. Vercel's free plan forbids commercial use. |
| Errors | Sentry (free tier) | Needed to catch iPad and Safari-only bugs. |
| Tests | Vitest (Arabic normalization, readability, stroke checker), Playwright (flows, mobile emulation), plus manual tests on a real iPad and iPhone | Safari is where the risk is. |

**Rejected options.** Next.js: no SEO need inside the app; a static marketing page can be added separately. Firebase: its NoSQL model fits progress, review and root data worse than Postgres. Native apps: too much cost, and a PWA covers the stylus and microphone needs.

### 1.2 Shape of the system

```
content/ (YAML lessons, audio, stroke data, sheets)  ──build script──▶  Supabase (lesson docs as JSON, audio in Storage)
                                                                         ▲
React PWA (Cloudflare Pages) ──auth──▶ Supabase Auth                     │ RLS: free lessons for all, paid lessons with entitlement
          │                                                              │
          ├── reads lessons, reading sets, word data ────────────────────┘
          ├── writes progress, attempts, SRS state, submissions (Storage + rows)
          └── Edge Function (on new submission / feedback) ──▶ Resend email + in-app notification row
```

**Content is written as files in the repo** (versioned and reviewable), then **published into the database**. The app loads it after login. It is not bundled into the public JavaScript. This matters for two reasons:
1. **Paywall.** Anything in the JS bundle can be downloaded for free.
2. **Word list licence.** The client only ever receives the words a lesson uses, after login. The full list is never shipped. The raw `.xlsx` stays in a git-ignored `data/private/` folder.

### 1.3 Arabic handling (one place, used everywhere)

- One `<Ar>` component renders all Arabic. It sets `lang="ar" dir="rtl"`, the Arabic font, `unicode-bidi: isolate`, the size scale, tap-to-hear, the transliteration line and the vowel show/hide state. The lint and review rule is that Arabic never appears outside `<Ar>`. This also fixes mixed English and Arabic sentences, where punctuation tends to land in the wrong place.
- The UI root is `dir="ltr"` (the UI is English). Arabic blocks are RTL islands.
- **Font:** Noto Naskh Arabic, self-hosted. It's a clear Naskh with good vowel-mark placement and a proper لا ligature. The alternative is Amiri. I'll show both in Phase 1a for you to choose.
- `lib/arabic.ts` holds all of the following, with unit tests:
  - `normalizeForCompare(s)`: apply NFC (this turns a decomposed ا+ٔ into أ). Remove harakat (U+064B–U+0652), dagger alif (U+0670), tatweel (U+0640) and ZWJ/ZWNJ. Map Persian look-alikes (ی→ي, ک→ك). **Keep** hamza seats, ة and ى, because they are taught items. A wrong hamza seat gets a specific hint ("check the hamza seat") rather than a plain "wrong".
  - `letterForm(letter, position)`: builds isolated, initial, medial and final forms with ZWJ, **for display only**.
  - `markOnCarrier(mark)`: shows a lone mark on a tatweel carrier ـَـ (display only; the dotted circle ◌ is missing from web Arabic fonts).
  - `requiredItems(voweledWord)`: the set of taught items a word needs (see 2.4).
  - Build-time validators: fail the content build if any answer string contains tatweel or ZWJ, or if any digit field uses Western digits before Unit 5.
- Eastern Arabic digits are stored as written. The Unicode bidi algorithm already lays them out left to right inside RTL text. I'll add a test for it.
- **Word builder joining:** splitting a word into one `<span>` per letter breaks joining in Safari. The builder renders the whole word as one shaped string and overlays the tile boundaries using measured glyph positions. Contextual ZWJ forms are the fallback.

---

## 2. Data model

User data lives in Postgres (Supabase). Lesson **content** is stored as one versioned JSON document per lesson, so the authored YAML maps to it directly.

### 2.1 People and roles

```
profiles        id (= auth.users.id), email, name_en, name_ar (nullable), name_ar_translit,
                name_audio_path (nullable), role: student|tutor|admin, created_at
user_settings   user_id, narration_on, font_scale, theme: system|light|dark,
                translit_mode: auto|on|off, show_vowels, playback_speed, pen_only
tutor_students  tutor_id, student_id                 -- later phase; admin sees everyone
entitlements    user_id, product, source, starts_at, ends_at   -- paywall, Phase 4
```
RLS: students read and write only their own rows. Tutors read their students' rows (admin reads all). Roles are checked through a `security definer` function `has_role()`.

### 2.2 Course content

```
units           id (u0…u6), order, title, milestone_kind
lessons         id ('u1-l03'), unit_id, order, type: letter|symbol|sound|review|checkpoint,
                title, is_free, version, content jsonb, teaches text[]  -- taught item ids
taught_items    id ('ba', 'fatha', 'hamza_alif', 'ta_marbuta', 'digit_3', 'lam_alif' …),
                kind: letter|variant|mark|digit|mechanic, glyph, name_en, name_ar,
                table_group, table_order, unit_id          -- drives the covered letter table
phrases         id, ar_voweled, en, translit, audio_path, heard_unit, read_unit
media           id, kind: audio|anim|stroke|sheet, path, duration_ms, source: placeholder|recorded
```
`lessons.content` (validated with a Zod schema shared by the build script and the app):
```
{ steps: [ { kind: learn|write|listen|read|speak|exercises,
             slides: [ { id, audio, captions:[{t, text}], cues:[{t, action, target}], visual: {...} } ],
             exercises: [ { id, type, prompt, items, answer, autoMark: bool, submit?: {...} } ] } ] }
```

### 2.3 Progress (with reset)

Reset is modelled as a **run**. Each student has one active run. Reset closes it and opens a new one. Progress rows hang off the run. Submissions and feedback hang off the user (with the run id kept for context), so they survive a reset.

```
path_runs          id, user_id, started_at, ended_at (null = active)
lesson_progress    run_id, lesson_id, status: open|in_progress|completed, last_slide, completed_at
exercise_attempts  run_id, lesson_id, exercise_id, correct, response jsonb, ms, created_at
srs_cards          run_id, item_ref ('word:51:1', 'letter:ba', 'phrase:salam'), due_at,
                   interval_d, ease, reps, lapses               -- FSRS or SM-2 state
streaks            user_id, current, best, last_active_date, daily_goal   -- not reset
user_badges        user_id, badge_id, earned_at                          -- not reset
```
- **Covered letter table** = the union of `lessons.teaches` over completed lessons in the active run. It is computed, not stored, so reset clears it automatically.
- **Unlocking:** lesson *n+1* is open when lesson *n* is completed in the active run. Scores never gate.

### 2.4 Words, roots, readability

```
words         id, source: core|alsaid, rank (nullable), form_no, ar_printed (as in source),
              ar_display (cleaned, defaults to printed), ar_bare, pos_tag, gloss_en, translit,
              concrete bool, image_ref (for animated meanings), priority, notes, audio_path,
              required_items text[]   -- computed by requiredItems()
              first_lesson_id         -- earliest lesson whose cumulative teaches ⊇ required_items
              review_status: draft|checked
roots         id, radicals ('ك ت ب'), meaning_en, notes, review_status
word_roots    word_id, root_id, pattern (optional, e.g. 'فاعِل')
reading_sets  lesson_id, word_ids[], sentence_ids[]     -- generated at build time
sentences     id, ar, en, word_ids[], audio_path, timings jsonb   -- for karaoke and the sentence builder
```
**`requiredItems(word)`** splits a word into base letters (with hamza seats, ة, ى and آ as separate items) plus every printed mark (fatha, damma, kasra, sukun, shadda, the three tanwin, dagger alif). It can also add **derived items**: لا ligature when ل is followed by ا, and the sun-letter article (ال + sun letter + shadda). The derived items are a question for you (Q-A2).

"Learned forms" on the word map = words whose `first_lesson_id` the student has completed in this run.

### 2.5 Submissions, feedback, notifications

```
submissions     id, user_id, run_id, lesson_id, exercise_id, kind: sheet|recording|photo,
                payload_path, strokes_path (sheets), thumb_path, duration_ms, self_rating 1–3,
                status: pending|reviewed|needs_redo, created_at, reviewed_at
feedback        id, submission_id, reviewer_id, note, annotations jsonb
                  -- sheets: ink strokes and pinned text in sheet coordinates
                  -- recordings: [{t_ms, note}] markers on the waveform; optional voice note path
                created_at
notifications   id, user_id, kind, ref_id, read_at, created_at
```
The review queue is a view: pending submissions joined to the student and lesson, oldest first, filterable by student, lesson and kind.

---

## 3. Feature breakdown

Effort: **S** ≈ under 1 day, **M** ≈ 2–4 days, **L** ≈ 1–2 weeks of build time. "Dep" lists what each feature needs first.

### A. Foundations
| # | Feature | Effort | Dep |
|---|---|---|---|
| A1 | Scaffold: Vite, TS, Tailwind, PWA manifest, Router, Sentry, CI checks | S | — |
| A2 | `<Ar>` component, fonts, `lib/arabic.ts` with tests, theme tokens, dark mode, font scale | M | A1 |
| A3 | Supabase project, schema migrations, RLS, role function, seed | M | A1 |
| A4 | Auth: sign-up (email, password, English name), login, reset password, Resend SMTP | M | A3 |
| A5 | Content schema (Zod), YAML → JSON build, validators, publish to Supabase | M | A2, A3 |
| A6 | Word list importer: xlsx → `words` table, cleaning, `requiredItems`, reading-set generator | M | A2, A5 |

### B. Lesson player
| # | Feature | Effort | Dep |
|---|---|---|---|
| B1 | Unit map (locked and unlocked lessons, progress rings) | S | A3, A5 |
| B2 | Six-step lesson flow with per-step progress and resume at the last slide | M | A5 |
| B3 | Narrated slide engine: audio plus a cue timeline driving the visuals, captions, repeat, rewind, proceed, narration on/off (tap-through mode) | L | B2 |
| B4 | Tap any Arabic to hear it, slow/normal toggle (`playbackRate` 0.75 with pitch kept) | S | A2 |
| B5 | Completed button: opens the next lesson, plays the tile-reveal animation | S | B1, E5 |

### C. Letters and writing
| # | Feature | Effort | Dep |
|---|---|---|---|
| C1 | Stroke data format and an authoring tool (admin traces centerlines over the font glyph) | M | A2 |
| C2 | Letter card: name, four forms, animated stroke order | M | C1 |
| C3 | Tracing over a ghost letter with automatic stroke count, order, direction and shape check | L | C1 |
| C4 | Word builder (drag letters, see them join) | M | A2 |
| C5 | Writing sheets on tablet: sheet template renderer, pen/finger ink, save strokes, submit | L | A3, F1 |
| C6 | Printable PDF sheets and photo-upload submission | M | C5 |
| C7 | On-screen Arabic keyboard (taught letters highlighted) and typing mode | M | A2 |

### D. Reading, listening, speaking
| # | Feature | Effort | Dep |
|---|---|---|---|
| D1 | Generated reading sets per lesson, show/hide vowels, transliteration fade | M | A6 |
| D2 | Karaoke highlight (word timings) | M | B3 |
| D3 | Sentence builder | S | D1 |
| D4 | Animated word meanings (cast of characters, sound effects) | L | B3, art |
| D5 | Sound discrimination (minimal pairs), dictation (type or assemble) | M | C7 |
| D6 | Slow-to-fast ladder | S | B4 |
| D7 | Shadowing: record, native and own clip back to back, two waveforms (plus pitch contour), "what to listen for" prompts, self-rating, submit | L | A3 |
| D8 | Mouth cross-section clips (~30 clips plus vowels) | L | art |

### E. Exercises and learning engine
| # | Feature | Effort | Dep |
|---|---|---|---|
| E1 | Exercise framework: shared shell, auto-marking, feedback, attempt logging | M | B2 |
| E2 | Types: matching, listen-and-pick, true/false, flashcards, fill-in-the-blank, drag-and-order | M | E1 |
| E3 | Types: tracing (C3), record-yourself (D7), dictation (D5) | S (wiring) | E1 |
| E4 | Timed speed round | S | E2 |
| E5 | Covered letter table (28 letters, variants ة ى أ إ ؤ ئ ء آ, marks, digits) | M | A5 |
| E6 | SRS daily review queue (FSRS), interleaving earlier letters into each unit | L | E1 |
| E7 | Weak-spot detection (error rates per item feed the SRS and a "weak items" list) | M | E6 |

### F. Accounts, review, notifications
| # | Feature | Effort | Dep |
|---|---|---|---|
| F1 | Submissions: upload to Storage, status lifecycle, student "My work" list | M | A3 |
| F2 | Review queue for tutor/admin | M | F1 |
| F3 | Feedback on the work: ink and text pins on sheets, time markers and notes on recordings, needs-redo | L | F2 |
| F4 | Notifications: in-app bell and email (Edge Function and Resend) both ways | M | F1, A4 |
| F5 | Admin: students list, **set Arabic name** (+ optional name audio), content status | M | A3 |
| F6 | Root editor and drafted roots for the 1,000 words, word map by root | L | A6 |

### G. Motivation and settings
| # | Feature | Effort | Dep |
|---|---|---|---|
| G1 | Settings: reset progress (with confirmation), narration, font size, dark mode, transliteration, vowels, pen-only | S | A3 |
| G2 | Quiet streak and daily goal | S | E1 |
| G3 | Milestone badges (SVG) | S | E1 |
| G4 | Student Arabic name in examples and narration placeholders | S | F5 |

### H. Later product layer
| # | Feature | Effort | Dep |
|---|---|---|---|
| H1 | Payments and paywall (entitlements, Lemon Squeezy or Paddle as merchant of record, or Stripe) | M | A3 |
| H2 | Offline: precache lessons and audio, IndexedDB queue for progress and submissions | L | A1 |
| H3 | Tutor layer: assigned students, weak items visible to the tutor, booking (Cal.com embed) | L | E7, F2 |

---

## 4. Phased roadmap

Each phase ends with a demo of it running on your iPad and phone before the next starts.

### Phase 1: Unit 0 and Unit 1, end to end (vertical slice)
I'll deliver Phase 1 in three steps and show each one running:

- **1a Foundations:** A1–A6, B1, G1 (narration, theme, font only), F5 (set Arabic name).
  *Demo:* sign up with your English name; set an Arabic name as admin; see the unit map; open Unit 0 lessons rendered from YAML; see the generated Unit 1 reading set (the 14 words); pick a font.
- **1b Lessons and exercises:** B2–B5, C1–C4, C7, D1, D2 (single words and the phrase bank), D5 (Unit 1 minimal pairs such as ت/ث and ب/ت), E1–E3, E5.
  *Demo:* full Unit 1 letter lessons with placeholder narration. The letter draws itself, you trace it with the Pencil and get checked, build words, read the 14 words with vowels on and off, do every Unit 1 exercise type, press Completed and watch tiles uncover.
- **1c Speaking, submissions and review:** C5, D7, F1–F4, G1 (reset), G4.
  *Demo:* shadow a word and compare; submit a recording; trace and submit the **Arabic name sheet** that closes Unit 1; you get an email; you annotate it in the review queue; the student sees "reviewed" or "needs redo"; reset progress and confirm that history stays.

Phase 1 leaves out: SRS queue, speed round, badges, PDFs, roots, character cast animations and mouth clips. Unit 1 sound slides use **static SVG mouth diagrams** as a placeholder.

### Phase 2: Unit 2 and the learning engine
Unit 2 content; E4, E6, E7 (SRS with interleaving, weak spots); D3 sentence builder; D6 slow-to-fast ladder; G2 streak and daily goal; G3 badges; C6 printable PDFs and photo submission; shadda and لا handling in `requiredItems`; first questions with ؟.

### Phase 3: Unit 3, roots and animation
Unit 3 content (tanwin, ة, ى, case endings); F6 root editor, drafted roots, word map; D4 animated meanings with the recurring cast (concrete Unit 1–2 words first, then ضَرَبَ أحْمَدُ خالِدًا style sentences); D8 mouth cross-section clips for Units 1–3; karaoke for full sentences and dialogues.

### Phase 4: Units 4 and 5, then paid launch
Unit 4 and 5 content (hamza seats, madd, dagger alif, wasl, sun letters, prefix letters, Western digits for recognition); remaining mouth clips; "اسمي ___" from memory; H1 payments and paywall (Unit 0 and the free part of Unit 1 stay free); legal pages; production hardening (Supabase Pro, backups, monitoring).

### Phase 5: Unit 6 and the tutor layer
Unit 6 (tricky cases, pause forms, traditional alphabet order, intonation, final test); H2 offline; H3 tutor layer. Cross-device sync of progress already works from Phase 1 because progress is stored on the server. Phase 5 adds sync for offline use.

---

## 5. Content pipeline

```
Word doc ──(1) convert──▶ content/units/u1/l03.yaml ──(2) audio + cues──▶ (3) validate & build ──▶ (4) preview ──▶ (5) publish
```

1. **Word to YAML.** For Units 0 and 1, you send the Word files as they are. I convert each lesson into structured YAML (slides, narration script, on-screen content, animation cues, exercises) and you review the YAML side by side with a rendered preview. After Unit 1, I propose a light Word template (styles such as `Slide`, `Narration`, `Screen`, `Exercise`) so later units convert automatically with `mammoth` (docx → structured HTML → YAML). Example:
   ```yaml
   id: u1-l02
   type: letter
   title: "Baa ب"
   teaches: [ba]
   steps:
     - kind: learn
       slides:
         - id: s1
           narration: "This is baa. It has one dot, below."
           visual: { show: letterCard, letter: ب }
           cues: [ { at: "baa", action: drawStrokes, target: ب } ]
     - kind: exercises
       exercises:
         - { type: listenPick, prompt: audio:word:220:1, options: [word:220:1, word:419:1, word:51:1] }
         - { type: trace, letter: ب, form: initial }
         - { type: record, target: word:220:1, submit: optional }
   ```
2. **Narration audio.** One file per slide, named `u1-l02-s1.m4a` (AAC, mono, 48 kHz; I'll send a one-page recording guide). Until your recordings exist, the build script **generates placeholder audio locally with macOS voices** (an English voice for narration, Majed for Arabic). Placeholders cost nothing, and the app shows a small "placeholder" badge in admin view. When you drop in a real file with the same name, it replaces the placeholder.
3. **Cues and captions.** Captions come from the narration text. Cue times (when the letter draws, when a word highlights) start as word anchors in the YAML ("at: baa") and are turned into timestamps in an admin **cue editor**: play the slide, tap to stamp each cue. Karaoke word timings use the same tool. Automatic forced alignment can replace the tapping later.
4. **Validation.** Schema check, taught-item references, audio exists, duration ≤ ~30 s (warning), no tatweel or ZWJ in answers, digits are Eastern, every Arabic string has audio.
5. **Publish.** `npm run content:publish` upserts lesson documents, reading sets and media into Supabase. Lessons are versioned, so a student partway through a lesson keeps working.

**Animations** plug in as named visuals that the slide YAML references:
- Stroke drawing uses stroke data from C1 (`content/strokes/ba.initial.json`).
- Slide motions (show form, highlight, move tile, join letters) are a fixed set of primitives.
- Character and mouth clips are Rive or Lottie files (or SVG components) in `content/anim/`, referenced by id.

---

## 6. Risks and unknowns

| Risk | Impact | Mitigation |
|---|---|---|
| **No open stroke-order data set for Arabic** (nothing like KanjiVG) | Stroke animation and tracing need data for every letter in every form | Build the authoring tool (C1). Unit 1 needs about 30 shapes. Author unit by unit. |
| **Tracing checker accuracy** (too strict frustrates, too loose teaches nothing) | Core writing feature | Tolerant matching (resampling and normalization, start/end direction, order of the main body before dots and marks). Show specific hints. Tune on your own handwriting and a few testers. |
| **iPad and iPhone Safari quirks**: audio needs a tap to start, MediaRecorder formats, Pencil palm rejection | Narration and recording | A "Start lesson" tap unlocks audio. Record in mp4/AAC where supported. Pen-only mode. Test on real devices every phase. |
| **Arabic shaping across letter tiles** | Word builder looks broken | Shape the whole word as one string and overlay tile boundaries (1.3). |
| **Word list licence not confirmed** | Legal exposure for a paid product | Never ship the full list. Serve only lesson subsets after login. Write to the author and journal before paid launch (Phase 4). The fallback is our own frequency list. |
| **Partly voweled or unvoweled source forms** | Beginners see under-voweled words, and the readability rule counts them as easy | Question Q-A2. A `ar_display` column allows reviewed corrections without changing the source. |
| **Content and audio volume**: about 60 lessons × 9 slides × ≤30 s is roughly 4–5 hours of finished narration, plus word audio | Your time is the bottleneck, not code | Placeholders unblock the build. You record unit by unit. Word audio is only needed for words that actually appear. |
| **Art assets** (cast, ~30 mouth clips) | Quality and cost | Phase 1–2 use simple in-code SVG. Commission or upgrade in Phase 3. |
| **Reviewer workload at scale**: you alone, with about 7 milestones plus optional recordings per student | At 1,000 students, possibly hundreds of items a week | Queue filters, a short feedback note template, optional recordings off by default, tutor role ready for more reviewers. |
| **Supabase free projects pause after a week of inactivity** | Outage for early users | Use Pro ($25/mo) from public launch. |
| **Email deliverability** | Sign-up and notification mail goes to spam | Own domain with SPF, DKIM and DMARC through Resend. |
| **Phase 1 scope is large** | Slow first demo | Split into 1a/1b/1c with demos. Leave SRS and art out of Phase 1. |
| **Privacy**: voice recordings and handwriting are personal data | GDPR / UK GDPR duties | EU or UK data region, a privacy policy, deletion on request, a retention policy for recordings. |

---

## 7. Questions for you

Each question has my recommended **default**. Reply "approved" to accept every default, or change any by number.

### A. Content and pedagogy
- **A1. Word documents.** Send them as they are and I convert them to YAML for your review?
  **Default:** yes. I propose a Word template after Unit 1.
- **A2. Readability rule details.** (a) Should unvoweled source forms (`أب`, `في`) count as readable once their letters are taught? (b) Should the rule also require the لا ligature (Unit 2) and the sun-letter article (Unit 5) as derived items? (c) `ابْن` uses hamzat al-wasl (Unit 5) but passes in Unit 1. Keep it?
  **Default:** (a) yes, but show them with a "no vowels printed" hint; (b) yes to both; (c) keep it, since it matches your 14.
- **A3. Glosses and transliteration** are missing from the list.
  **Default:** I draft English glosses and transliteration for all 1,250 forms. You check them unit by unit, starting with the 14 Unit 1 words.
- **A4. Transliteration scheme and fade.**
  **Default:** learner-friendly: ā ī ū, th dh kh gh sh, ʔ (hamza), ʕ (ʿayn), dotted ḥ ṣ ḍ ṭ ẓ. Always on in Units 0–2, tap-to-reveal in Units 3–4, off from Unit 5 (the setting can override).
- **A5. Carrier for lone vowel marks.** (changed: tatweel ـَـ, display only, because web fonts lack ◌)
  **Default:** dotted circle ◌َ.
- **A6. Free boundary.** Which lessons of Unit 1 are free?
  **Default:** Unit 0 plus Unit 1 lessons 1–4. Payments only start in Phase 4.
- **A7. Writing sheets.**
  **Default:** I generate sheets from templates declared in the lesson YAML (letter rows, word rows, the name sheet). You can also supply a custom sheet as an image or PDF.
- **A8. Phrase bank.**
  **Default:** you list the greetings per unit. I draft a starter list for Units 1–2 for you to edit.
- **A9. Entries with tatweel** (`لـ(ه)`, `بـ(ه)`, `وَحْدَ(ه)`).
  **Default:** clean them to لَهُ, بِهِ, وَحْدَهُ (keeping the source text in `notes`). They enter reading sets only when their letters and marks are taught.

### B. Audio and media
- **B1. Who records Arabic letter, word and phrase audio** (not only narration)?
  **Default:** you, unit by unit. Placeholder TTS until then.
- **B2. Slow speed.**
  **Default:** pitch-preserving 0.75× playback. Truly slow recordings only for letters and syllables.
- **B3. Student's name in narration.** Recorded narration can't say each student's name.
  **Default:** the name appears on screen and in examples only. *Option:* when you set a student's Arabic name, you also record a two-second clip, and narration plays it at marked points.
- **B4. Art for the cast and mouth clips.**
  **Default:** simple in-code SVG for Phases 1–2, then decide whether to commission art (budget is in section 8).
- **B5. Animation tool for the cast.**
  **Default:** Rive (free tier, small files, interactive). Lottie if your illustrator prefers After Effects.

### C. Accounts, review and product
- **C1. Sign-in method.**
  **Default:** email and password. Add Google sign-in in Phase 2.
- **C2. Domain.** Do you own one (for example daaduna.com or .app)?
  **Default:** buy one (~$12–15 a year). It's needed for email.
- **C3. Reviewer emails.**
  **Default:** one email per submission now, with a switch to a daily digest.
- **C4. Placeholder before the Arabic name is set.**
  **Default:** examples use a neutral stand-in (طالِب / "Student") plus a note that "your Arabic name is coming". You get an admin alert for each new sign-up.
- **C5. What reset clears.**
  **Default:** clears lesson progress, exercise attempts, the covered table and the SRS queue. Keeps submissions, feedback, badges and streak.
- **C6. Where you and your students are based** (for the data region and privacy law).
  **Default:** EU (Frankfurt) or London Supabase region, GDPR-style privacy policy.
- **C7. Payment model** (decided in Phase 4).
  **Default:** one-time purchase for the Literacy course through a merchant of record (Lemon Squeezy or Paddle), which handles VAT.

### D. Technical
- **D1. Repository.**
  **Default:** I run `git init` here and you create a **private** GitHub repo. The raw word list is never committed.
- **D2. Devices.**
  **Default:** test on iPad with Apple Pencil (Safari), iPhone (Safari) and Android Chrome. Tell me which you actually have.
- **D3. Font.**
  **Default:** Noto Naskh Arabic. I show Amiri next to it in Phase 1a.
- **D4. Supabase plan.**
  **Default:** free tier while building, Pro at public launch.

---

## 8. Cost estimate (USD per month unless stated)

Assumptions: about 4–5 hours of narration at 64 kbps AAC (~150 MB), word and phrase audio (~100 MB), student recordings ~0.25 MB each, sheets ~0.3 MB each (strokes plus thumbnail).

| Item | Launch (≤100 students) | 1,000 students |
|---|---|---|
| Hosting (Cloudflare Pages) | $0 | $0 |
| Supabase (DB, Auth, Storage, Edge Functions) | $0 while building, **$25 Pro** from public launch (8 GB DB, 100 GB storage, 250 GB egress) | $25–35. Storage ~10–20 GB, egress ~50–100 GB, inside Pro. If egress grows, move public audio to Cloudflare R2 (no egress fees, ~$0–2). |
| Email (Resend) | $0 (3,000 a month) | ~$20 (about 10–30k emails a month) |
| Domain | ~$1 (≈$12–15 a year) | ~$1 |
| Error tracking (Sentry) | $0 | $0–26 |
| Placeholder TTS (local macOS voices) | $0 | $0 |
| Payments (Phase 4) | — | Merchant of record ~5% + $0.50 per sale, or Stripe ~1.5–2.9% + fees (you handle VAT) |
| **Running total** | **$0–26** | **≈ $50–80 plus payment fees** |
| One-off (optional): commissioned art for the cast and ~30 mouth clips | — | Roughly $1,500–6,000, depending on the artist. Can be phased. |
| One-off (optional): microphone for narration | ~$100–150 (USB condenser) | — |

Prices are from memory as of late 2026. I'll confirm them at sign-up for each service.

---

## 9. Proposed repo layout

```
daaduna/
  app/                  React PWA (src/components/Ar.tsx, src/lib/arabic.ts, player/, exercises/, review/, admin/)
  content/              units/*/lesson.yaml, audio/, strokes/, anim/, sheets/, phrases.yaml, items.yaml
  data/private/         AlSaid xlsx (git-ignored)
  scripts/              import-words, build-content, gen-placeholder-audio, publish
  supabase/             migrations/, functions/ (notify), seed.sql
  PLAN.md
```
