# MZ Drive Utilities (Unified Cloud Suite)

An all-in-one Google Drive cloud suite combining:
- **File In Drive Upload (FIDU):** Direct URL streaming and local file uploader with ZIP extraction straight into Google Drive.
- **D-VAC (Drive Video to Audio Converter):** Convert Google Drive videos into high-quality 192kbps MP3 audio via cloud FFmpeg.

---

## 📁 Unified Repository Structure (یکجا ریپوزٹری ساخت)

```
drive-tools-hub/
├── backend/                       # Python FastAPI + FFmpeg Converter Backend (for Render.com)
│   ├── Dockerfile                 # Debian slim Dockerfile with FFmpeg pre-installed
│   ├── main.py                    # FastAPI application (/api/convert & /api/health)
│   └── requirements.txt           # Python dependencies
│
├── src/                           # Frontend React 19 application
│   ├── lib/
│   │   ├── firebase.ts            # Auth & Token Client (GIS + Firebase)
│   │   └── google-picker.ts       # Google Drive Picker API integration
│   ├── App.tsx                    # Main App router, Hub, Uploader & D-VAC components
│   ├── main.tsx
│   └── index.css
│
├── public/                        # Static assets (logo.png)
├── server.ts                      # Node.js + Express local development / full-stack server
├── package.json                   # Frontend dependencies & build scripts
├── vite.config.ts                 # Vite bundler configuration
├── tsconfig.json                  # TypeScript configuration
├── vercel.json                    # Vercel SPA routing & API proxy configuration
├── render.yaml                    # Render.com Blueprint (builds backend/Dockerfile)
└── .env.example                   # Environment configuration template
```

---

## 🚀 Unified Deployment Guide

### 1. Vercel (Frontend)
1. Link this single repository (`drive-tools-hub`) to **Vercel**.
2. Framework Preset: **Vite**
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Environment Variables on Vercel:
   - `VITE_BACKEND_URL`: `https://drive-video-to-audio-converter.onrender.com`
6. `vercel.json` in the root automatically routes SPA pages (`/uploader`, `/dvac`) to `/index.html` and proxies `/api/*` to the Render backend.

### 2. Render.com (Conversion Backend)
1. Link this SAME repository (`drive-tools-hub`) to **Render.com**.
2. Create a **Web Service** with:
   - **Environment:** `Docker`
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Docker Context:** `backend`
   *(Or simply use the included `render.yaml` Blueprint)*
3. Environment Variables:
   - `PORT`: (Provided automatically by Render)

---

## 💻 Local Development

### Option A: Local Node Full-Stack
```bash
npm install
npm run dev
```
Runs the full-stack server at `http://localhost:3000`.

### Option B: Local Python Backend (Optional)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 10000
```
