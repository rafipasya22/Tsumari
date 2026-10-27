# Tsumari (つまり)

Turn a podcast, lecture or YouTube video into a chaptered summary with timestamps, then play the whole recording or just one chapter.

Tsumari is a React Native app (Expo) backed by a FastAPI service and a background worker. You sign in, pick an audio/video file or paste a YouTube link, the backend transcribes it, splits it into topic chapters, writes a TL;DR and a summary per chapter, and the app shows the result with tap-to-play timestamps. Every account only sees its own library.

## Features

- **Accounts**: email and password sign-in through Supabase Auth, using a draggable bottom sheet instead of a separate screen. Each user only sees their own summaries.
- **Import a file**: pick audio or video (MP3, WAV, M4A, MP4, OGG, FLAC, AAC, WebM, up to 200 MB), see its name, type and size, choose the spoken language or leave it on auto-detect.
- **Import a YouTube link**: paste a link (watch, youtu.be, shorts, embed, live URLs). The backend downloads the audio with yt-dlp, summarizes it, then deletes the downloaded file.
- **Background processing**: uploads become jobs in a queue. The app polls progress and shows each job's stage and percentage under *In Progress*.
- **Summary page**: media player on top, then TL;DR and a list of chapters, each with a timestamp, title and summary. Opens automatically when a job finishes.
- **Media panel**: uploaded video plays in a native video player, uploaded audio shows an animated spectrum, YouTube links play in an embedded YouTube player.
- **Play by chapter**: play the full recording, or tap a chapter to jump to its start and stop at its end.
- **Library**: *Latest Summary* card and a *Recent* list on Home. Every finished job is stored, so old summaries can be reopened any time.
- **Profile**: display name, profile photo (Supabase Storage), password change and log out from Settings.

## How it works

```
Expo app ──(Bearer token)──▶ FastAPI ──job row──▶ Supabase (Postgres)
   ▲   │                        │                       ▲
   │   └─ sign in ─▶ Supabase   │ stores input file     │ claim / update
   │        Auth                │                       │
   └──── poll status ───────────┘                    Worker
                         audio (or yt-dlp) → chunks → Groq Whisper → chaptering → LLM summaries
```

1. The app signs in with Supabase Auth and sends the access token with every API request.
2. `POST /jobs` (file) or `POST /jobs/youtube` (link) creates a `queued` job owned by the user. File uploads are saved to disk, YouTube jobs only store the video id.
3. The worker claims the next queued job and runs the pipeline:
   1. Download the audio first if the job is a YouTube link (yt-dlp).
   2. Convert and split the audio into chunks (ffmpeg).
   3. Transcribe each chunk with Groq Whisper, with retry and backoff on rate limits.
   4. Embed the transcript with a sentence-transformers model and split it into topic chapters.
   5. Ask an LLM for chapter titles, summaries and a TL;DR.
4. The result and transcript are written back to the job row and the status becomes `done`.
5. The app sees `done` and opens `/summary/<id>`. Uploaded media is streamed from the API, YouTube jobs play from YouTube.

## Tech stack

| Layer | Tools |
| --- | --- |
| Mobile | React Native, Expo (Expo Go), Expo Router, TypeScript, Reanimated, Gesture Handler, `expo-document-picker`, `expo-audio`, `expo-video`, `expo-image-picker`, `react-native-youtube-iframe` |
| API | FastAPI, Pydantic, Uvicorn |
| Worker | Python, ffmpeg, yt-dlp, Groq (Whisper + LLM), sentence-transformers |
| Data and auth | Supabase (Postgres `jobs` table, Auth, Storage for avatars) |
| Deployment | Docker, Docker Compose |

## API

All routes except `/health` need `Authorization: Bearer <supabase access token>`. A job that belongs to another user returns `404`, the same as a job that does not exist.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/jobs` | Upload a file (`file`, optional `language` code like `en`/`id`, optional `filename`). Returns `202` with the job id |
| `POST` | `/jobs/youtube` | Create a job from a YouTube link (`{ "url": "...", "language": "en" }`). Returns `202` |
| `GET` | `/jobs?status=done&limit=20` | List your jobs, newest first. `status` can repeat |
| `GET` | `/jobs/{id}` | Status, stage, progress and result |
| `GET` | `/jobs/{id}/transcript` | Full transcript (only when `done`) |
| `GET` | `/jobs/{id}/audio` | The original uploaded file (used by the audio and video players) |

## Project structure

```
tsumari/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   └── app/
│       ├── api/        # FastAPI app and schemas
│       ├── core/       # settings, auth, Supabase client, job queue functions
│       ├── pipeline/   # audio, youtube, transcribe, chapters, run
│       └── worker/     # queue worker loop
└── mobile/
    ├── app/
    │   ├── (tabs)/     # Home, Import, Settings + custom floating tab bar
    │   └── summary/    # [id].tsx summary + player screen
    ├── components/     # AuthSheet, MediaPanel
    └── lib/            # api client, supabase client, auth context
```

## Getting started

### Prerequisites

- Docker (recommended), or Python 3.11+ with [ffmpeg](https://ffmpeg.org/) on your `PATH`
- Node.js 20+ and the Expo Go app on your phone
- A [Supabase](https://supabase.com/) project and a [Groq](https://console.groq.com/) API key

### 1. Supabase

**Database.** Create a `jobs` table with at least these columns: `id` (uuid, primary key), `user_id` (uuid, references `auth.users`), `status`, `stage`, `progress`, `filename`, `input_path`, `language`, `youtube_id`, `error`, `result` (jsonb), `transcript` (jsonb), `created_at`, `updated_at`. Keep Row Level Security enabled. The backend uses the service key and enforces ownership itself.

**Auth.** Enable the email provider. For local testing you can turn off *Confirm email*, but turn it back on before real users sign up.

**Storage.** Create a public bucket named `avatars` and add policies so each user can only insert, update and select files in the folder named after their own user id:

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar insert own" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar update own" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar select own" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
```

### 2. Backend

Create `backend/.env`:

```env
GROQ_API_KEY=...
WHISP=whisper-large-v3-turbo
LLM_MODEL=...                  # a Groq chat model
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...       # service key; keep it server-side only
```

**With Docker (recommended):**

```bash
docker compose up --build
```

This starts two containers from one image: `api` on port 8000 and `worker`. They share a named volume mounted at `/data` for uploaded files, and the sentence-transformers model cache is stored there too. Rebuild with `--build` after changing backend code.

**Without Docker:**

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

uvicorn app.api.main:app --host 0.0.0.0 --reload
python -m app.worker.run       # in a second terminal
```

The worker marks jobs left in `running` by a previous crash as failed on startup, then polls for queued jobs.

### 3. Mobile app

Create `mobile/.env` with your project URL and the **anon** (public) key. Never put the service key in the app:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

```bash
cd mobile
npm install
npx expo start
```

## limitations

- Uploaded files are kept on the server's disk under `jobs_dir/<job_id>/`. Summaries live in the database, but playback of uploads needs that file to still exist. YouTube audio is deleted after processing and the video plays from YouTube.
- YouTube downloads reject live streams and videos over 3 hours. Some videos cannot be embedded and will not play in the in-app player.
- Groq's free tier is rate limited. The transcriber retries with backoff, so long files can take a while.
- The API verifies tokens by asking Supabase Auth and caches the result for 60 seconds.
- Sessions are stored with the default Supabase storage in the app. Move them to `expo-secure-store` before shipping.
