# 看看学中文 — Mandarin Learning App

Learn Mandarin Chinese by scanning everyday objects with your camera. Powered by Claude AI + ElevenLabs real human voice.

## Features

- 📷 **Scan any object** — take a photo or upload one, Claude identifies it instantly
- 🔊 **Real human voice** — ElevenLabs Multilingual v2 for natural Mandarin pronunciation
- 🐢 **Normal + Slow mode** — hear words at full or learner speed
- 🃏 **3 flashcard modes** — flip cards, multiple choice, and type-in
- 📖 **Personal word list** — save scanned words with their photos
- 📊 **Progress tracking** — track new, learning, and mastered words

## Deploy to Vercel (free, 5 minutes)

### Step 1 — Get your API keys

**Anthropic (for photo scanning):**
1. Go to https://console.anthropic.com
2. Sign up → API Keys → Create Key
3. Copy the key (starts with sk-ant-)

**ElevenLabs (for real human voice):**
1. Go to https://elevenlabs.io
2. Sign up free → click profile icon → Profile + API key
3. Copy the API key
4. Free tier gives 10,000 characters/month

### Step 2 — Run locally
```bash
npm install
cp .env.local.example .env.local
# Edit .env.local and add both API keys
npm run dev
```
Open http://localhost:3000

### Step 3 — Deploy to Vercel
```bash
npx vercel
```
When prompted, add both environment variables:
- ANTHROPIC_API_KEY
- ELEVENLABS_API_KEY

Or deploy via GitHub:
1. Push to a GitHub repo
2. Go to vercel.com → New Project → Import repo
3. Add both environment variables
4. Click Deploy!

## Voice options
The app uses ElevenLabs `eleven_multilingual_v2` model with the Rachel voice by default.
To change voice, edit `pages/api/speak.js` and change the default voice in the VOICES object.

Available voices: rachel (female), domi (female), bella (female), antoni (male), josh (male)

## Cost
- Photo scan: ~$0.002–$0.005 per scan (Anthropic)
- Voice: 10,000 characters/month free (ElevenLabs), then $5/month for 30,000 chars
