// pages/index.js
import { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import styles from '../styles/App.module.css';

const DEFAULT_WORDS = [
  { chinese: '海绵', pinyin: 'hǎi mián', english: 'Sponge', example_zh: '我用海绵擦桌子。', example_en: 'I use a sponge to wipe the table.', category: 'household', status: 'new', img: null },
  { chinese: '苹果', pinyin: 'píng guǒ', english: 'Apple', example_zh: '这是一个苹果。', example_en: 'This is an apple.', category: 'food', status: 'new', img: null },
  { chinese: '书', pinyin: 'shū', english: 'Book', example_zh: '我在看书。', example_en: 'I am reading a book.', category: 'household', status: 'learning', img: null },
  { chinese: '椅子', pinyin: 'yǐ zi', english: 'Chair', example_zh: '请坐椅子上。', example_en: 'Please sit on the chair.', category: 'household', status: 'new', img: null },
  { chinese: '水杯', pinyin: 'shuǐ bēi', english: 'Water cup', example_zh: '桌上有一个水杯。', example_en: 'There is a water cup on the table.', category: 'household', status: 'learning', img: null },
  { chinese: '手机', pinyin: 'shǒu jī', english: 'Mobile phone', example_zh: '我的手机在桌上。', example_en: 'My phone is on the table.', category: 'technology', status: 'new', img: null },
];

// Audio cache so we don't re-fetch the same word repeatedly
const audioCache = {};
let currentAudio = null;

async function speak(text, slow = false) {
  if (!text || typeof window === 'undefined') return;

  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  const cacheKey = `${text}__${slow ? 'slow' : 'normal'}`;

  try {
    let audioUrl;

    if (audioCache[cacheKey]) {
      // Use cached audio URL
      audioUrl = audioCache[cacheKey];
    } else {
      // Fetch from Google TTS proxy
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, slow }),
      });

      if (!res.ok) {
        // Fallback to browser TTS if API fails
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = slow ? 0.5 : 0.85;
        window.speechSynthesis.speak(u);
        return;
      }

      const blob = await res.blob();
      audioUrl = URL.createObjectURL(blob);
      audioCache[cacheKey] = audioUrl; // cache it
    }

    currentAudio = new Audio(audioUrl);
    currentAudio.play();
  } catch (err) {
    console.error('TTS error, falling back to browser voice:', err);
    // Graceful fallback to browser speech synthesis
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = slow ? 0.5 : 0.85;
      window.speechSynthesis.speak(u);
    }
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── SCAN SCREEN ──────────────────────────────────────────────
function ScanScreen({ onWordScanned, existingWord }) {
  const [state, setState] = useState('idle'); // idle | loading | result | error
  const [result, setResult] = useState(existingWord || null);
  const [errorMsg, setErrorMsg] = useState('');
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef();
  const videoRef = useRef();
  const [camOn, setCamOn] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    if (existingWord) { setResult(existingWord); setState('result'); }
  }, [existingWord]);

  async function handleFile(file) {
    if (!file) return;
    setState('loading');
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(',')[1];
      const mediaType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      try {
        const res = await fetch('/api/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const word = { ...data, img: dataUrl, status: 'new' };
        setResult(word);
        setState('result');
        setSaved(false);
        renderCutout(dataUrl);
        setTimeout(() => speak(data.chinese), 600);
        onWordScanned(word);
      } catch (err) {
        setState('error');
        setErrorMsg(err.message || 'Could not identify object. Try a clearer photo.');
      }
    };
    reader.readAsDataURL(file);
  }

  async function toggleCam() {
    if (camOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setCamOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setCamOn(true);
      } catch { alert('Camera permission denied. Use Upload instead.'); }
    }
  }

  function snapPhoto() {
    if (!camOn || !videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(blob => { handleFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.9);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCamOn(false);
  }

  function renderCutout(dataUrl) {
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current; if (!c) return;
      const mw = 340, mh = 160;
      let w = img.width, h = img.height;
      if (w > mw) { h = h * (mw / w); w = mw; }
      if (h > mh) { w = w * (mh / h); h = mh; }
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      const cut = document.createElement('canvas');
      cut.width = w; cut.height = h;
      const cc = cut.getContext('2d');
      cc.drawImage(img, 0, 0, w, h);
      cc.globalCompositeOperation = 'destination-in';
      cc.beginPath(); cc.ellipse(w / 2, h / 2, w * 0.44, h * 0.46, 0, 0, Math.PI * 2); cc.fill();
      ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(cut, 0, 0);
    };
    img.src = dataUrl;
  }

  function reset() { setState('idle'); setResult(null); setSaved(false); }

  return (
    <div className={styles.screen}>
      <div className={styles.pageHdr}>
        <div className={styles.pageTitle}>Scan object</div>
        <div className={styles.pageSub}>Take or upload a photo to learn Chinese</div>
      </div>

      {state === 'idle' && (
        <div className={styles.scanMain}>
          <div className={styles.cameraBox}>
            <video ref={videoRef} autoPlay playsInline muted className={styles.videoEl} style={{ display: camOn ? 'block' : 'none' }} />
            {!camOn && (
              <div className={styles.camPh}>
                <span className={styles.camIcon}>📷</span>
                <p>Point at any object</p>
              </div>
            )}
          </div>
          <div className={styles.scanBtns}>
            <button className={styles.scanBtn} onClick={toggleCam}>
              {camOn ? '⏹ Stop' : '📷 Camera'}
            </button>
            {camOn
              ? <button className={`${styles.scanBtn} ${styles.primary}`} onClick={snapPhoto}>📸 Snap</button>
              : <label className={`${styles.scanBtn} ${styles.primary}`}>
                  📤 Upload photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                </label>
            }
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <p>Identifying object with Claude AI...</p>
        </div>
      )}

      {state === 'error' && (
        <div className={styles.errorBox}>
          <strong>Could not identify object.</strong><br />
          {errorMsg}<br /><br />
          <button className={styles.agBtn} onClick={reset}>Try again</button>
        </div>
      )}

      {state === 'result' && result && (
        <div className={styles.resCard}>
          <div className={styles.resImgWrap}>
            <canvas ref={canvasRef} className={styles.cutoutCanvas} />
          </div>
          <div className={styles.resBody}>
            <div className={styles.catBadge}>{result.category || 'object'}</div>
            <div className={styles.resZh}>{result.chinese}</div>
            <div className={styles.resProw}>
              <div className={styles.resPy}>{result.pinyin}</div>
              <button className={styles.spkIc} onClick={() => speak(result.chinese)} aria-label="Pronounce word">🔊</button>
            </div>
            <div className={styles.resEn}>{result.english}</div>
            <div className={styles.exHdr}>
              <div className={styles.exLbl}>Example sentence</div>
              <div className={styles.spdRow}>
                <button className={styles.spd} onClick={() => speak(result.example_zh, false)}>▶ Normal</button>
                <button className={styles.spd} onClick={() => speak(result.example_zh, true)}>🐢 Slow</button>
              </div>
            </div>
            <div className={styles.exZh}>{result.example_zh}</div>
            <div className={styles.exEn}>{result.example_en}</div>
            <button
              className={`${styles.svBtn} ${saved ? styles.saved : ''}`}
              onClick={() => { onWordScanned(result, true); setSaved(true); }}
            >
              {saved ? '✓ Saved!' : '🔖 Save to word list'}
            </button>
            <button className={styles.agBtn} onClick={reset}>↩ Scan another object</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FLASHCARD SCREEN ─────────────────────────────────────────
function FlashcardScreen({ words }) {
  const [mode, setMode] = useState('flip');
  const [set, setSet] = useState([]);
  const [q, setQ] = useState(0);
  const [score, setScore] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [typeVal, setTypeVal] = useState('');
  const [typeResult, setTypeResult] = useState(null);
  const [done, setDone] = useState(false);

  const init = useCallback((m = mode) => {
    setSet(shuffle(words));
    setQ(0); setScore(0); setFlipped(false);
    setChosen(null); setTypeVal(''); setTypeResult(null); setDone(false);
  }, [words, mode]);

  useEffect(() => { init(); }, [mode, words.length]);

  const cur = set[q];
  const pct = set.length ? Math.round((q / set.length) * 100) : 0;

  function next() {
    if (q + 1 >= set.length) { setDone(true); return; }
    setQ(q + 1); setFlipped(false); setChosen(null); setTypeVal(''); setTypeResult(null);
    if (set[q + 1]) setTimeout(() => speak(set[q + 1].chinese), 300);
  }

  useEffect(() => { if (cur) speak(cur.chinese); }, [cur?.chinese]);

  const options = cur ? shuffle([cur, ...shuffle(words.filter(w => w.chinese !== cur.chinese)).slice(0, 3)]) : [];

  function checkType() {
    if (!cur || typeResult) return;
    const val = typeVal.trim().toLowerCase();
    const correct = cur.english.toLowerCase();
    const ok = val === correct || (correct.includes(val) && val.length > 2);
    setTypeResult(ok ? 'correct' : 'wrong');
    if (ok) setScore(s => s + 1);
  }

  if (done) {
    const pct2 = Math.round((score / set.length) * 100);
    return (
      <div className={styles.screen}>
        <div className={styles.pageHdr}><div className={styles.pageTitle}>Flashcards</div></div>
        <div className={styles.resultBox}>
          <div className={styles.resultEmoji}>{pct2 >= 80 ? '🎉' : pct2 >= 50 ? '👍' : '💪'}</div>
          <div className={styles.resultTitle}>{score}/{set.length} correct</div>
          <div className={styles.resultSub}>{pct2 >= 80 ? 'Excellent work!' : pct2 >= 50 ? 'Good progress!' : 'Keep practicing!'}</div>
          <button className={styles.restartBtn} onClick={() => init()}>↩ Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.pageHdr}>
        <div className={styles.pageTitle}>Flashcards</div>
        <div className={styles.pageSub}>Chinese → English</div>
      </div>
      <div className={styles.modePills}>
        {['flip', 'mc', 'type'].map(m => (
          <button key={m} className={`${styles.pill} ${mode === m ? styles.on : ''}`} onClick={() => setMode(m)}>
            {m === 'flip' ? '🃏 Flip' : m === 'mc' ? '☑ Choice' : '⌨ Type'}
          </button>
        ))}
      </div>
      <div className={styles.fcWrap}>
        <div className={styles.progRow}>
          <div className={styles.progBar}><div className={styles.progFill} style={{ width: pct + '%' }} /></div>
          <span className={styles.progT}>{q + 1}/{set.length}</span>
          <span className={styles.scT}>✓ {score}</span>
        </div>

        {cur && mode === 'flip' && (
          <>
            <div className={`${styles.flipCard} ${flipped ? styles.flipped : ''}`} onClick={() => !flipped && setFlipped(true)}>
              <div className={styles.flipFront}>
                <div className={styles.fZh}>{cur.chinese}</div>
                <div className={styles.fPy}>{cur.pinyin}</div>
                <div className={styles.fHint}>tap to reveal</div>
              </div>
              <div className={styles.flipBack}>
                <div className={styles.fEn}>{cur.english}</div>
                <div className={styles.fEx}>{cur.example_zh}</div>
                <div className={styles.fHint}>how did you do?</div>
              </div>
            </div>
            {flipped && (
              <div className={styles.rateRow}>
                <button className={`${styles.rb} ${styles.rw}`} onClick={() => next()}>✗ Again</button>
                <button className={`${styles.rb} ${styles.rg}`} onClick={() => { setScore(s => s + 1); next(); }}>✓ Got it</button>
              </div>
            )}
          </>
        )}

        {cur && mode === 'mc' && (
          <>
            <div className={styles.mcCard}>
              <div className={styles.mcZh}>{cur.chinese}</div>
              <div className={styles.mcPy}>{cur.pinyin}</div>
              <div className={styles.mcPrompt}>What does this mean in English?</div>
            </div>
            <div className={styles.mcOpts}>
              {options.map((o, i) => {
                let cls = styles.mo;
                if (chosen) cls += o.english === cur.english ? ` ${styles.ok}` : chosen === o.english ? ` ${styles.no}` : '';
                return (
                  <button key={i} className={cls} disabled={!!chosen} onClick={() => {
                    setChosen(o.english);
                    if (o.english === cur.english) setScore(s => s + 1);
                  }}>{o.english}</button>
                );
              })}
            </div>
            {chosen && <button className={`${styles.nxBtn} ${styles.on}`} onClick={next}>Next →</button>}
          </>
        )}

        {cur && mode === 'type' && (
          <>
            <div className={styles.tyCard}>
              <div className={styles.tyZh}>{cur.chinese}</div>
              <div className={styles.tyPy}>{cur.pinyin}</div>
              <div className={styles.tyPrompt}>Type the English meaning</div>
            </div>
            <div className={styles.tyRow}>
              <input
                className={`${styles.tyIn} ${typeResult === 'correct' ? styles.ok : typeResult === 'wrong' ? styles.no : ''}`}
                value={typeVal} onChange={e => setTypeVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkType()}
                placeholder="Type in English..." disabled={!!typeResult}
              />
              <button className={styles.tyGo} onClick={checkType} disabled={!!typeResult}>Check</button>
            </div>
            {typeResult && (
              <div className={`${styles.tyFb} ${typeResult === 'correct' ? styles.ok : styles.no}`}>
                {typeResult === 'correct' ? `✓ Correct! "${cur.english}"` : `✗ Answer: "${cur.english}"`}
              </div>
            )}
            {typeResult && <button className={`${styles.nxBtn} ${styles.on}`} onClick={next}>Next →</button>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── WORD LIST SCREEN ─────────────────────────────────────────
function WordsScreen({ words, onSpeak }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? words : words.filter(w => w.status === filter);

  return (
    <div className={styles.screen}>
      <div className={styles.pageHdr}>
        <div className={styles.pageTitle}>My words</div>
        <div className={styles.pageSub}>Your personal vocabulary list</div>
      </div>
      <div className={styles.wlStats}>
        <div className={styles.ws}><div className={styles.wsN}>{words.length}</div><div className={styles.wsL}>Saved</div></div>
        <div className={styles.ws}><div className={styles.wsN}>{words.filter(w => w.status === 'mastered').length}</div><div className={styles.wsL}>Mastered</div></div>
        <div className={styles.ws}><div className={styles.wsN}>{words.filter(w => w.status === 'learning').length}</div><div className={styles.wsL}>Learning</div></div>
      </div>
      <div className={styles.fpRow}>
        {['all', 'new', 'learning', 'mastered'].map(f => (
          <button key={f} className={`${styles.fp} ${filter === f ? styles.on : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className={styles.wlList}>
        {filtered.length === 0 && <div className={styles.emptyState}>No words in this category yet.</div>}
        {filtered.map((w, i) => (
          <div key={i} className={styles.wr}>
            <div className={styles.wThumb}>
              {w.img ? <img src={w.img} alt={w.english} /> : <span>{w.chinese[0]}</span>}
            </div>
            <div className={styles.wInfo}>
              <div className={styles.wZh}>{w.chinese}</div>
              <div className={styles.wPy}>{w.pinyin}</div>
              <div className={styles.wEn}>{w.english}</div>
            </div>
            <button className={styles.wSpk} onClick={() => speak(w.chinese)} aria-label="Pronounce">🔊</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────
function SettingsScreen() {
  const [toggles, setToggles] = useState({ autoPronounce: true, pinyin: true, srs: true, reminder: false });
  const toggle = k => setToggles(t => ({ ...t, [k]: !t[k] }));

  return (
    <div className={styles.screen}>
      <div className={styles.pageHdr}><div className={styles.pageTitle}>Settings</div></div>
      <div className={styles.setBody}>
        <div className={styles.profileCard}>
          <div className={styles.avatar}>学</div>
          <div className={styles.profileName}>Language Learner</div>
          <div className={styles.profileSub}>Learning Mandarin Chinese</div>
        </div>
        <div className={styles.setLbl}>Study</div>
        {[
          { key: 'autoPronounce', title: 'Auto-pronounce on scan', sub: 'Play word audio automatically' },
          { key: 'pinyin', title: 'Show pinyin', sub: 'Display romanized pronunciation' },
          { key: 'srs', title: 'Spaced repetition', sub: 'Smart review scheduling' },
          { key: 'reminder', title: 'Daily reminder', sub: 'Notification to practice' },
        ].map(({ key, title, sub }) => (
          <div key={key} className={styles.setRow}>
            <div><div className={styles.setT}>{title}</div><div className={styles.setS}>{sub}</div></div>
            <button className={`${styles.tog} ${toggles[key] ? styles.on : ''}`} onClick={() => toggle(key)} aria-label={title} />
          </div>
        ))}
        <div className={styles.setLbl}>Language</div>
        <div className={styles.setRow}><div><div className={styles.setT}>Speech speed</div></div><span className={styles.setVal}>Normal</span></div>
        <div className={styles.setRow}><div><div className={styles.setT}>Character style</div></div><span className={styles.setVal}>Simplified</span></div>
        <div className={styles.setLbl}>About</div>
        <div className={styles.setRow}><div><div className={styles.setT}>Version</div></div><span className={styles.setVal}>1.0.0</span></div>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────
function HomeScreen({ words, onNav }) {
  const mastered = words.filter(w => w.status === 'mastered').length;
  return (
    <div className={styles.screen}>
      <div className={styles.pageHdr}>
        <div className={styles.pageTitle}>Learn Mandarin</div>
        <div className={styles.pageSub}>Good morning! Keep going 🔥</div>
      </div>
      <div className={styles.secLbl}>Your progress</div>
      <div className={`${styles.mx} ${styles.row}`}>
        <div className={`${styles.statCard} ${styles.col}`}><div className={styles.statIc}>📚</div><div className={styles.statN}>{words.length}</div><div className={styles.statL}>Words saved</div></div>
        <div className={`${styles.statCard} ${styles.col}`}><div className={styles.statIc}>🏆</div><div className={styles.statN}>{mastered}</div><div className={styles.statL}>Mastered</div></div>
      </div>
      <div className={styles.secLbl}>Quick start</div>
      <div className={styles.mx}>
        {[
          { id: 'scan', icon: '📷', title: 'Scan an object', sub: 'Upload a photo to learn Chinese', color: '#E1F5EE' },
          { id: 'fc', icon: '🃏', title: 'Practice flashcards', sub: 'Flip, choice, or type-in mode', color: '#EEEDFE' },
          { id: 'words', icon: '📖', title: 'My word list', sub: 'Review saved vocabulary', color: '#E6F1FB' },
        ].map(({ id, icon, title, sub, color }) => (
          <div key={id} className={styles.actCard} onClick={() => onNav(id)}>
            <div className={styles.actIc} style={{ background: color }}>{icon}</div>
            <div className={styles.actInfo}><div className={styles.actT}>{title}</div><div className={styles.actS}>{sub}</div></div>
            <span>›</span>
          </div>
        ))}
      </div>
      <div className={styles.secLbl}>Recent words</div>
      <div className={styles.mx}>
        {words.slice(0, 3).map((w, i) => (
          <div key={i} className={styles.recRow}>
            <div className={styles.recZh}>{w.chinese}</div>
            <div className={styles.recInf}><div className={styles.recPy}>{w.pinyin}</div><div className={styles.recEn}>{w.english}</div></div>
            <span className={`${styles.badge} ${w.status === 'mastered' ? styles.bm : w.status === 'learning' ? styles.bl : styles.bn}`}>{w.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('home');
  const [words, setWords] = useState(DEFAULT_WORDS);
  const [lastScanned, setLastScanned] = useState(null);
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(`${n.getHours()}:${String(n.getMinutes()).padStart(2, '0')}`);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  function handleWordScanned(word, save = false) {
    setLastScanned(word);
    if (save && !words.find(w => w.chinese === word.chinese)) {
      setWords(prev => [...prev, { ...word, status: 'new' }]);
    }
  }

  const NAV = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'scan', icon: '📷', label: 'Scan' },
    { id: 'fc', icon: '🃏', label: 'Practice' },
    { id: 'words', icon: '📖', label: 'Words' },
    { id: 'set', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <>
      <Head>
        <title>看看学中文 — Learn Mandarin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="description" content="Learn Mandarin Chinese by scanning everyday objects with your camera" />
      </Head>
      <div className={styles.phone}>
        <div className={styles.sbar}>
          <span className={styles.sbarTime}>{time}</span>
          <div className={styles.sbarR}>📶 🔋</div>
        </div>
        <div className={styles.screens}>
          {tab === 'home' && <HomeScreen words={words} onNav={setTab} />}
          {tab === 'scan' && <ScanScreen onWordScanned={handleWordScanned} existingWord={lastScanned} />}
          {tab === 'fc' && <FlashcardScreen words={words} />}
          {tab === 'words' && <WordsScreen words={words} />}
          {tab === 'set' && <SettingsScreen />}
        </div>
        <div className={styles.bnav}>
          {NAV.map(({ id, icon, label }) => (
            <button key={id} className={`${styles.ni} ${tab === id ? styles.on : ''}`} onClick={() => setTab(id)}>
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
