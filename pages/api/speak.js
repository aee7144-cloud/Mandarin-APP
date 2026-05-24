// pages/api/speak.js
// ElevenLabs Text-to-Speech proxy — keeps API key server-side

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

// Best multilingual voice IDs from ElevenLabs
const VOICES = {
  rachel:  '21m00Tcm4TlvDq8ikWAM',  // Female, natural — default
  domi:    'AZnzlk1XvdvUeBnXmlld',  // Female, confident
  bella:   'EXAVITQu4vr4xnSDxMaL',  // Female, soft
  antoni:  'ErXwobaYiN019PkySvjV',  // Male, well-rounded
  josh:    'TxGEqnHWrfWFTfGW9XjX',  // Male, deep
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, slow = false, voice = 'rachel' } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to your .env.local' });
  }

  const voiceId = VOICES[voice] || VOICES.rachel;
  const speakingRate = slow ? 0.7 : 1.0;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',  // Best model for Mandarin
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
            speed: speakingRate,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.detail?.message || err.detail || `ElevenLabs error ${response.status}`;
      console.error('ElevenLabs error:', msg);
      return res.status(response.status).json({ error: msg });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');  // cache 24h
    res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('TTS proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
