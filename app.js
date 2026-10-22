// Merge data
const ALL_DATA = [...DATA, ...DATA2];

// ==================== STATE ====================
let learned = JSON.parse(localStorage.getItem('ncx_learned') || '{}');
let currentSection = null;
let currentMode = 'list';
let flashIndex = 0;
let flashRevealed = false;
let filteredWords = [];

function saveLearned() {
  localStorage.setItem('ncx_learned', JSON.stringify(learned));
}

// ==================== THEME ====================
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('ncx_theme', isDark ? 'light' : 'dark');
}

(function initTheme() {
  const t = localStorage.getItem('ncx_theme');
  if (t === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeBtn').textContent = '☀️';
  }
})();

// ==================== HELPERS ====================
function wordKey(secId, i) { return secId + '_' + i; }

function isLearned(secId, i) { return !!learned[wordKey(secId, i)]; }

function toggleLearned(secId, i) {
  const k = wordKey(secId, i);
  if (learned[k]) delete learned[k];
  else learned[k] = 1;
  saveLearned();
  updateGlobalProgress();
}

function totalWords() {
  return ALL_DATA.reduce((s, sec) => s + sec.words.length, 0);
}

function learnedWords() {
  return Object.keys(learned).length;
}

function updateGlobalProgress() {
  const total = totalWords();
  const done = learnedWords();
  const pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressText').textContent = pct + '% (' + done + '/' + total + ')';
  document.getElementById('learnedCount').textContent = done;
  document.getElementById('totalSections').textContent = ALL_DATA.length;
  document.getElementById('totalWords').textContent = total;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 1800);
}

// ==================== SPEAK (neural mp3 + fallback) ====================
let __au = null;
function __norm(t) {
  return (t || '').replace(/[^A-Za-z\u00C0-\u024F\s']/g, '').replace(/\s+/g, ' ').trim();
}
function speak(text) {
  const idx = window.AUDIO_INDEX || {};
  const key = idx[text] ? text : (idx[__norm(text)] ? __norm(text) : null);
  if (key) {
    if (__au) { try { __au.pause(); } catch (e) {} }
    __au = new Audio('audio/' + idx[key]);
    __au.play().catch(() => __speakFallback(text));
    return;
  }
  __speakFallback(text);
}
function __speakFallback(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 0.88;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }
}
function renderSections() {
  const grid = document.getElementById('sectionsGrid');
  grid.innerHTML = '';
  ALL_DATA.forEach(sec => {
    const total = sec.words.length;
    let done = 0;
    sec.words.forEach((_, i) => { if (isLearned(sec.id, i)) done++; });
    const pct = Math.round(done / total * 100);
    const card = document.createElement('div');
    card.className = 'sec-card';
    card.innerHTML = `
      ${done === total ? '<span class="done-badge">✅ مكتمل</span>' : ''}
      <span class="sec-emoji">${sec.emoji}</span>
      <h3>${sec.title}</h3>
      <div class="sec-it">${sec.italian}</div>
      <div class="sec-count">${total} كلمة • ${pct}% مُتعلّمة</div>
      <div class="sec-progress"><i style="width:${pct}%"></i></div>
    `;
    card.onclick = () => openSection(sec.id);
    grid.appendChild(card);
  });
}

function goHome() {
  document.getElementById('wordsView').classList.remove('active');
  document.getElementById('quizView').classList.remove('active');
  document.getElementById('homeView').classList.remove('hidden');
  currentSection = null;
  renderSections();
  updateGlobalProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== WORDS VIEW ====================
function openSection(id) {
  currentSection = ALL_DATA.find(s => s.id === id);
  if (!currentSection) return;
  flashIndex = 0;
  flashRevealed = false;
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('quizView').classList.remove('active');
  document.getElementById('wordsView').classList.add('active');
  document.getElementById('wordSearch').value = '';

  document.getElementById('wordsHeader').innerHTML = `
    <div class="w-emoji">${currentSection.emoji}</div>
    <div class="w-info">
      <h2>${currentSection.title}</h2>
      <div class="w-it">${currentSection.italian} — ${currentSection.words.length} كلمة</div>
    </div>
    <button class="quiz-here" onclick="startQuizFromWords()">🧪 اختبرني في هذا القسم</button>
  `;

  filteredWords = currentSection.words.map((w, i) => ({ it: w[0], ar: w[1], dg: w[2], idx: i }));
  renderMode();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMode(mode) {
  const n = nativeSR();
  if (voiceActive) {
    if (n) { try { n.stop(); } catch (e) {} }
    else if (voiceRec) { try { voiceRec.stop(); } catch (e) {} }
  }
  clearTimeout(voiceTimer);
  currentMode = mode;
  ['modeList', 'modeFlash', 'modeGrid', 'modeVoice'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('mode' + mode.charAt(0).toUpperCase() + mode.slice(1)).classList.add('active');
  flashIndex = 0;
  flashRevealed = false;
  if (mode === 'voice' && voiceSec && voiceSec.id !== (currentSection && currentSection.id)) {
    voiceQs = [];
  }
  renderMode();
}

function filterWords(q) {
  q = q.trim().toLowerCase();
  if (!currentSection) return;
  if (!q) {
    filteredWords = currentSection.words.map((w, i) => ({ it: w[0], ar: w[1], dg: w[2], idx: i }));
  } else {
    filteredWords = currentSection.words
      .map((w, i) => ({ it: w[0], ar: w[1], dg: w[2], idx: i }))
      .filter(w => w.it.toLowerCase().includes(q) || w.ar.includes(q) || (w.dg && String(w.dg).includes(q)));
  }
  flashIndex = 0;
  flashRevealed = false;
  renderMode();
}

function renderMode() {
  const el = document.getElementById('modeContent');
  if (currentMode === 'list') renderList(el);
  else if (currentMode === 'flash') renderFlash(el);
  else if (currentMode === 'voice') renderVoice(el);
  else renderGrid(el);
}

function renderList(el) {
  if (!filteredWords.length) { el.innerHTML = '<p style="text-align:center;color:var(--text2);padding:40px;">لا توجد نتائج</p>'; return; }
  el.innerHTML = '<div class="words-list">' + filteredWords.map((w, n) => {
    const lr = isLearned(currentSection.id, w.idx);
    const badge = currentSection.id === 3 ? (w.dg || w.ar) : (n + 1);
    return `
      <div class="word-item ${lr ? 'learned' : ''}" data-i="${w.idx}">
        <div class="wi-num">${badge}</div>
        <div class="wi-words">
          <div class="wi-it">${w.it}</div>
          <div class="wi-ar">${w.ar}</div>
        </div>
        <button class="wi-speaker" onclick="event.stopPropagation();speak('${w.it.replace(/'/g, "\\'")}')" title="استمع">🔊</button>
        <button class="check-btn" onclick="event.stopPropagation();toggleLearnedUI(${w.idx}, this)" title="تعلّمتها">${lr ? '✓' : ''}</button>
      </div>
    `;
  }).join('') + '</div>';

  el.querySelectorAll('.word-item').forEach(item => {
    item.onclick = () => {
      const i = parseInt(item.dataset.i);
      toggleLearned(currentSection.id, i);
      renderMode();
      renderSections();
    };
  });
}

function toggleLearnedUI(idx, btn) {
  toggleLearned(currentSection.id, idx);
  renderMode();
  renderSections();
}

function renderFlash(el) {
  if (!filteredWords.length) { el.innerHTML = '<p style="text-align:center;color:var(--text2);padding:40px;">لا توجد نتائج</p>'; return; }
  if (flashIndex >= filteredWords.length) flashIndex = 0;
  const w = filteredWords[flashIndex];
  const total = filteredWords.length;
  const lr = isLearned(currentSection.id, w.idx);

  el.innerHTML = `
    <div class="flash-wrap">
      <div class="flash-card ${flashRevealed ? 'revealed' : ''}" onclick="revealFlash()">
        <div class="it-word">${w.it}</div>
        ${flashRevealed
          ? `<div class="ar-word">${w.ar}</div>${w.dg ? `<div class="flash-dg">${w.dg}</div>` : ''}`
          : `<div class="hint-text">اضغط لعرض الترجمة</div>`}
        ${flashRevealed ? `<div class="flash-stars">${lr ? '⭐' : ''}</div>` : ''}
      </div>
      <div class="flash-nav">
        <button class="btn-prev" onclick="prevFlash()">◀ السابق</button>
        <span class="flash-counter">${flashIndex + 1} / ${total}</span>
        <button class="btn-next" onclick="nextFlash()">التالي ▶</button>
        <button class="btn-dunno" onclick="markFlash(false)">❌ لم أعرف</button>
        <button class="btn-know" onclick="markFlash(true)">✅ عرفتها</button>
      </div>
      <div style="margin-top:14px;">
        <button class="wi-speaker" style="width:48px;height:48px;font-size:1.4rem;" onclick="speak('${w.it.replace(/'/g, "\\'")}')">🔊</button>
      </div>
    </div>
  `;
}

function revealFlash() {
  flashRevealed = !flashRevealed;
  const w = filteredWords[flashIndex];
  if (flashRevealed && w) speak(w.it);
  renderFlash(document.getElementById('modeContent'));
}

function nextFlash() {
  flashIndex = (flashIndex + 1) % filteredWords.length;
  flashRevealed = false;
  renderFlash(document.getElementById('modeContent'));
}

function prevFlash() {
  flashIndex = (flashIndex - 1 + filteredWords.length) % filteredWords.length;
  flashRevealed = false;
  renderFlash(document.getElementById('modeContent'));
}

function markFlash(ok) {
  const w = filteredWords[flashIndex];
  if (w) {
    if (ok && !isLearned(currentSection.id, w.idx)) toggleLearned(currentSection.id, w.idx);
    if (!ok && isLearned(currentSection.id, w.idx)) toggleLearned(currentSection.id, w.idx);
  }
  showToast(ok ? '✅ أحسنت!' : '📚 حاول مرة أخرى');
  renderSections();
  nextFlash();
}

function renderGrid(el) {
  if (!filteredWords.length) { el.innerHTML = '<p style="text-align:center;color:var(--text2);padding:40px;">لا توجد نتائج</p>'; return; }
  el.innerHTML = '<div class="words-grid">' + filteredWords.map(w => {
    const lr = isLearned(currentSection.id, w.idx);
    return `
      <div class="grid-word ${lr ? 'learned' : ''}" onclick="toggleLearnedGrid(${w.idx})" title="${w.ar}">
        <div class="gw-it">${w.it}</div>
        <div class="gw-ar">${lr ? '✅ ' : ''}${w.ar}</div>
      </div>
    `;
  }).join('') + '</div>';
}

function toggleLearnedGrid(idx) {
  toggleLearned(currentSection.id, idx);
  renderMode();
  renderSections();
}

// ==================== GLOBAL SEARCH ====================
function globalSearchFn(q) {
  q = q.trim().toLowerCase();
  const results = document.getElementById('searchResults');
  const list = document.getElementById('searchList');
  if (!q) {
    results.style.display = 'none';
    return;
  }
  results.style.display = 'block';
  const found = [];
  ALL_DATA.forEach(sec => {
    sec.words.forEach((w, i) => {
      if (w[0].toLowerCase().includes(q) || w[1].includes(q)) {
        found.push({ it: w[0], ar: w[1], sec: sec.title, emoji: sec.emoji });
      }
    });
  });
  if (!found.length) {
    list.innerHTML = '<p style="color:var(--text2)">لا توجد نتائج</p>';
    return;
  }
  list.innerHTML = found.slice(0, 60).map((w, n) => `
    <div class="word-item">
      <div class="wi-num">${n + 1}</div>
      <div class="wi-words">
        <div class="wi-it">${w.it}</div>
        <div class="wi-ar">${w.ar} <small style="opacity:.7">${w.emoji} ${w.sec}</small></div>
      </div>
      <button class="wi-speaker" onclick="event.stopPropagation();speak('${w.it.replace(/'/g, "\\'")}')">🔊</button>
    </div>
  `).join('');
  document.querySelector('#searchResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==================== QUIZ ====================
let quizSec = null;
let quizQs = [];
let quizI = 0;
let quizScore = 0;
let quizAnswered = false;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function quizShell(showPick, showArea) {
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('wordsView').classList.remove('active');
  document.getElementById('quizView').classList.add('active');
  document.getElementById('quizPick').style.display = showPick ? 'block' : 'none';
  document.getElementById('quizArea').style.display = showArea ? 'block' : 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openQuiz() {
  quizShell(true, false);
  document.getElementById('quizArea').innerHTML = '';
  document.getElementById('quizPick').innerHTML =
    '<div class="section-title">🧪 اختر قسم الاختبار</div>' +
    '<div class="sections-grid">' + ALL_DATA.map(sec => `
      <div class="sec-card" onclick="startQuiz(${sec.id})">
        <span class="sec-emoji">${sec.emoji}</span>
        <h3>${sec.title}</h3>
        <div class="sec-it">${sec.italian}</div>
        <div class="sec-count">${sec.words.length} كلمة</div>
      </div>`).join('') + '</div>';
}

function startQuizFromWords() {
  if (currentSection) startQuiz(currentSection.id);
}

function startQuiz(secId) {
  const sec = ALL_DATA.find(s => s.id === secId);
  if (!sec) return;
  quizSec = sec;

  const pool = sec.words
    .map((w, i) => ({ it: w[0], ar: w[1], dg: w[2], idx: i }))
    .filter(w => w.it && w.ar && w.it.trim() && w.ar.trim() && w.it.trim() !== w.ar.trim());

  const n = Math.min(10, pool.length);
  quizQs = shuffle(pool.slice()).slice(0, n).map(w => {
    const dir = Math.random() < 0.5 ? 'it2ar' : 'ar2it';
    const answer = dir === 'it2ar' ? w.ar : w.it;
    const opts = [answer];
    const seen = new Set([answer]);
    shuffle(pool.slice()).some(p => {
      const o = dir === 'it2ar' ? p.ar : p.it;
      if (o !== answer && !seen.has(o)) { seen.add(o); opts.push(o); }
      return opts.length === 4;
    });
    return { word: w, dir, answer, opts: shuffle(opts) };
  });

  if (!quizQs.length) { showToast('لا توجد كلمات كافية في هذا القسم'); return; }

  quizI = 0;
  quizScore = 0;
  quizAnswered = false;
  quizShell(false, true);
  renderQuizQ();
}

function renderQuizQ() {
  const q = quizQs[quizI];
  const total = quizQs.length;
  quizAnswered = false;
  const area = document.getElementById('quizArea');
  const prompt = q.dir === 'it2ar'
    ? `<div class="qq-word"><span id="qqSpoken">${q.word.it}</span><button class="wi-speaker" id="qqSpeak" title="استمع">🔊</button></div>`
    : `<div class="qq-word ar">${q.word.ar}</div>`;
  area.innerHTML = `
    <div class="quiz-top">
      <span>${quizSec.emoji} ${quizSec.title}</span>
      <span class="qt-score">النتيجة: ${quizScore} ✅</span>
    </div>
    <div class="quiz-bar"><i style="width:${Math.round(quizI / total * 100)}%"></i></div>
    <div class="quiz-card">
      <div class="qq-num">سؤال ${quizI + 1} من ${total}</div>
      ${prompt}
      <div class="qq-hint">${q.dir === 'it2ar' ? 'ما معنى هذه الكلمة بالعربية؟' : 'ما الكلمة الإيطالية المقابلة؟'}</div>
      <div class="qq-opts">${q.opts.map((o, i) => `<button class="qq-opt" data-o="${i}">${o}</button>`).join('')}</div>
    </div>
  `;
  area.querySelectorAll('.qq-opt').forEach(btn => {
    btn.onclick = () => answerQuiz(parseInt(btn.dataset.o), btn);
  });
  const sp = document.getElementById('qqSpeak');
  if (sp) sp.onclick = () => speak(q.word.it);
  if (q.dir === 'it2ar') speak(q.word.it);
}

function answerQuiz(i, btn) {
  if (quizAnswered) return;
  quizAnswered = true;
  const q = quizQs[quizI];
  const ok = q.opts[i] === q.answer;
  btn.parentElement.querySelectorAll('.qq-opt').forEach((b, j) => {
    b.disabled = true;
    if (q.opts[j] === q.answer) b.classList.add('correct');
    else if (b === btn) b.classList.add('wrong');
  });
  if (ok) {
    quizScore++;
    if (!isLearned(quizSec.id, q.word.idx)) toggleLearned(quizSec.id, q.word.idx);
    showToast('✅ إجابة صحيحة!');
  } else {
    showToast('❌ الصحيحة: ' + q.answer);
  }
  setTimeout(() => {
    quizI++;
    if (quizI < quizQs.length) renderQuizQ();
    else quizEnd();
  }, 1100);
}

function quizEnd() {
  const total = quizQs.length;
  const pct = Math.round(quizScore / total * 100);
  const msg = pct === 100 ? '🌟 ممتاز! إتقان كامل'
    : pct >= 70 ? '👏 أحسنت! قريب من الإتقان'
    : pct >= 50 ? '👍 جيد — راجع الكلمات الصعبة'
    : '📚 تحتاج مراجعة هذا القسم';
  document.getElementById('quizArea').innerHTML = `
    <div class="quiz-card quiz-result">
      <div class="qr-emoji">${pct >= 70 ? '🏆' : pct >= 50 ? '💪' : '📖'}</div>
      <div class="qr-score">${quizScore} / ${total}</div>
      <div class="qr-pct">${pct}%</div>
      <div class="qr-msg">${msg} — ${quizSec.emoji} ${quizSec.title}</div>
      <div class="qr-actions">
        <button class="qr-primary" onclick="startQuiz(${quizSec.id})">🔄 إعادة الاختبار</button>
        <button class="qr-ghost" onclick="openQuiz()">🧪 اختيار قسم آخر</button>
        <button class="qr-ghost" onclick="goHome()">◀ الأقسام</button>
      </div>
    </div>
  `;
  renderSections();
  updateGlobalProgress();
}

// ==================== VOICE ====================
let voiceSec = null;
let voiceQs = [];
let voiceI = 0;
let voiceScores = [];
let voiceRec = null;
let voiceActive = false;
let voiceDone = false;
let voiceTimer = null;
let voicePartial = null;
let voiceState = null;

function nativeSR() {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return (window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition) || null;
    }
  } catch (e) {}
  return null;
}

function speechSupported() {
  return !!(nativeSR() || window.SpeechRecognition || window.webkitSpeechRecognition);
}

function __normCompare(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s']/g, ' ').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function speechSimilarity(expected, heard) {
  const a = __normCompare(expected), b = __normCompare(heard);
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  return Math.max(0, Math.min(100, Math.round((1 - d / Math.max(a.length, b.length)) * 100)));
}

function voiceSession(sec) {
  voiceSec = sec;
  const pool = sec.words.map((w, i) => ({ it: w[0], ar: w[1], dg: w[2], idx: i })).filter(w => w.it && __normCompare(w.it));
  voiceQs = shuffle(pool.slice()).slice(0, Math.min(10, pool.length));
  voiceI = 0;
  voiceScores = [];
}

function renderVoice(el) {
  if (!currentSection) return;
  if (!speechSupported()) {
    el.innerHTML = `
    <div class="quiz-card" style="text-align:center">
      <div class="qr-emoji">🎙️</div>
      <h3 style="margin:10px 0">تحدّي الصوت غير مدعوم هذا التصفح</h3>
      <p style="color:var(--text2);line-height:1.9">يكتب النتائج عبر ميكروفون المتصفح، ويحتاج Chrome أو Edge على الجوال أو الكمبيوتر.<br>في الآيفون استخدم Safari؟ غير مدعوم حالياً — باقي الأوضاع تعمل عادي ✅</p>
    </div>`;
    return;
  }
  if (!voiceQs.length || !voiceSec || voiceSec.id !== currentSection.id) voiceSession(currentSection);
  if (!voiceQs.length) {
    el.innerHTML = `<div class="quiz-card" style="text-align:center"><div class="qr-emoji">🎙️</div><h3>لا توجد كلمات لهذا القسم</h3></div>`;
    return;
  }
  if (voiceI >= voiceQs.length) return renderVoiceEnd(el);

  const q = voiceQs[voiceI];
  voiceDone = false;
  el.innerHTML = `
  <div class="quiz-top">
    <span>تحدّي الصوت 🎙️</span>
    <span>${voiceI + 1} / ${voiceQs.length}</span>
  </div>
  <div class="quiz-bar"><i style="width:${(voiceI / voiceQs.length) * 100}%"></i></div>
  <div class="quiz-card voice-card">
    <div class="qq-num">اسمع الكلمة ثم كرّرها بصوتك</div>
    <div class="vv-word">${q.it}</div>
    <div class="vv-ar">${q.ar || ''}</div>
    <button class="vv-play" onclick="speak('${(q.it || '').replace(/'/g, "\\'")}', this)">🔊 استمع مرة أخرى</button>
    <button class="vv-mic" id="vvMic" onclick="voiceMicClick()">🎙️ اضغط وتكلّم</button>
    <div class="vv-live" id="vvLive"></div>
    <div class="vv-result" id="vvResult"></div>
    <div class="vv-next" id="vvNext" style="display:none"><button class="qr-primary" onclick="voiceNext()">التالي ▶</button></div>
  </div>`;
  speak(q.it);
}

function voiceMicClick() {
  if (voiceDone) return;
  const n = nativeSR();
  if (n) {
    if (voiceActive) { try { n.stop(); } catch (e) {} return; }
    startVoiceListeningNative();
    return;
  }
  if (voiceActive && voiceRec) { try { voiceRec.stop(); } catch (e) {} return; }
  startVoiceListening();
}

function voiceMicReset() {
  const mic = document.getElementById('vvMic');
  if (mic) { mic.classList.remove('listening'); mic.textContent = '🎙️ اضغط وتكلّم'; }
}

async function startVoiceListeningNative() {
  const q = voiceQs[voiceI];
  const p = nativeSR();
  if (!p) return;
  const live = document.getElementById('vvLive');
  let heard = [];
  voiceActive = true;
  voiceDone = false;
  const mic = document.getElementById('vvMic');
  if (mic) { mic.classList.add('listening'); mic.textContent = '🔴 جارٍ الاستماع… (اضغط للإيقاف)'; }
  if (live) live.textContent = '';
  const cleanup = () => {
    voiceActive = false;
    clearTimeout(voiceTimer);
    if (voicePartial) { try { voicePartial.remove(); } catch (e) {} voicePartial = null; }
    if (voiceState) { try { voiceState.remove(); } catch (e) {} voiceState = null; }
  };
  const finish = () => {
    if (!voiceActive) return;
    cleanup();
    voiceMicReset();
    if (heard.length) {
      let bh = heard[0], bb = -1;
      heard.forEach(t => { const s = speechSimilarity(q.it, t); if (s > bb) { bb = s; bh = t; } });
      finalizeVoice(bb, String(bh).trim());
    }
  };
  try {
    const perm = await p.requestPermissions();
    const st = perm && (perm.speechRecognition || perm.recognition);
    if (st && st !== 'granted' && st !== 'prompt') {
      cleanup();
      voiceMicReset();
      showToast('اسمح للميكروفون من إعدادات التطبيق');
      return;
    }
    voicePartial = await p.addListener('partialResults', (d) => {
      if (d && d.matches && d.matches.length) {
        heard = d.matches.slice();
        if (live) live.textContent = '«' + heard[0] + '»';
      }
    });
    voiceState = await p.addListener('listeningState', (d) => {
      if (d && d.status === 'stopped') finish();
    });
    await p.start({ language: 'it-IT', maxResults: 5, partialResults: true, popup: false });
    voiceTimer = setTimeout(() => { try { p.stop(); } catch (e) {} }, 8000);
  } catch (e) {
    cleanup();
    voiceMicReset();
    const msg = String((e && (e.message || e.errorMessage)) || e);
    if (/internet|network|connection/i.test(msg)) showToast('التعرّف الصوتي يحتاج إنترنت — تأكد من الاتصال');
    else showToast('تعذّر تشغيل الميكروفون — تأكد من تفعيل خدمة الصوت في الجهاز');
  }
}

function startVoiceListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || voiceDone) return;
  const q = voiceQs[voiceI];
  let heard = '', best = 0;
  voiceRec = new SR();
  voiceRec.lang = 'it-IT';
  voiceRec.interimResults = true;
  voiceRec.maxAlternatives = 5;
  voiceRec.continuous = false;
  const mic = document.getElementById('vvMic');
  const live = document.getElementById('vvLive');
  voiceActive = true;
  if (mic) { mic.classList.add('listening'); mic.textContent = '🔴 جارٍ الاستماع… (اضغط للإيقاف)'; }
  if (live) live.textContent = '';
  voiceRec.onresult = (e) => {
    let tb = 0, th = '';
    for (let i = 0; i < e.results.length; i++) {
      for (const alt of e.results[i]) {
        const s = speechSimilarity(q.it, alt.transcript);
        if (s > tb) { tb = s; th = alt.transcript; }
      }
    }
    if (th) { heard = th; best = tb; }
    if (live && th) live.textContent = '«' + th + '»';
  };
  const finish = () => {
    if (!voiceActive) return;
    voiceActive = false;
    clearTimeout(voiceTimer);
    if (mic) { mic.classList.remove('listening'); mic.textContent = '🎙️ اضغط وتكلّم'; }
    if (heard.trim()) finalizeVoice(best, heard.trim());
    else if (live) live.textContent = '';
  };
  voiceRec.onend = finish;
  voiceRec.onerror = (e) => {
    voiceActive = false;
    clearTimeout(voiceTimer);
    if (mic) { mic.classList.remove('listening'); mic.textContent = '🎙️ اضغط وتكلّم'; }
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast('اسمح للمتصفح باستخدام الميكروفون');
    else if (e.error === 'network') showToast('التعرّف على الصوت يحتاج إنترنت');
    else if (e.error === 'no-speech') showToast('ما سمعتك — حاول مرة ثانية');
  };
  try { voiceRec.start(); } catch (e) { return; }
  voiceTimer = setTimeout(() => { try { voiceRec.stop(); } catch (e) {} }, 8000);
}

function finalizeVoice(pct, heard) {
  if (voiceDone) return;
  voiceDone = true;
  voiceScores.push(pct);
  const q = voiceQs[voiceI];
  const pass = pct >= 70;
  const res = document.getElementById('vvResult');
  if (res) res.innerHTML = `
    <div class="vv-pct ${pass ? 'ok' : 'low'}">${pct}%</div>
    <div class="vv-heard">سمعتك: «${heard}»</div>
    <div class="vv-exp">الصحيح: «${q.it}»</div>
    <div class="vv-note">${pass ? '✅ نطق ممتاز — انحفظت مع الكلمات المحفوظة' : '🔁 قريب… أعد المحاولة لتصل 70%'}</div>`;
  if (pass && !isLearned(voiceSec.id, q.idx)) toggleLearned(voiceSec.id, q.idx);
  const mic = document.getElementById('vvMic');
  if (mic) { mic.disabled = true; mic.style.opacity = '.45'; }
  const nx = document.getElementById('vvNext');
  if (nx) nx.style.display = 'flex';
  renderSections();
  updateGlobalProgress();
}

function voiceNext() {
  if (!voiceDone) return;
  voiceI++;
  const el = document.getElementById('modeContent');
  if (voiceI >= voiceQs.length) renderVoiceEnd(el);
  else renderVoice(el);
}

function renderVoiceEnd(el) {
  const sum = voiceScores.reduce((a, b) => a + b, 0);
  const avg = voiceScores.length ? Math.round(sum / voiceScores.length) : 0;
  const emoji = avg >= 85 ? '🏆' : avg >= 70 ? '🎉' : avg >= 50 ? '💪' : '🎙️';
  const msg = avg >= 85 ? 'نطقك ممتاز! استمر' : avg >= 70 ? 'نتيجة حلوة — كرّر لتحسين النطق' : avg >= 50 ? 'بداية جيدة — اسمع الكلمة أكثر وكرّر' : 'لا بأس، الاستماع المتكرر يصنع الفرق';
  el.innerHTML = `
  <div class="quiz-card" style="text-align:center">
    <div class="qr-emoji">${emoji}</div>
    <h3 style="margin:8px 0">نتيجة تحدّي الصوت</h3>
    <div class="qr-score" style="margin:10px 0">${avg}%</div>
    <div class="qr-sub">متوسط النطق الصحيح عبر ${voiceScores.length} كلمة</div>
    <div style="color:var(--text2);margin:10px 0 18px">${msg}</div>
    <div class="qr-actions">
      <button class="qr-primary" onclick="voiceSession(currentSection);renderMode()">🔄 إعادة</button>
      <button class="qr-outline" onclick="setMode('list')">📋 العودة للكلمات</button>
      <button class="qr-outline" onclick="goHome()">🏠 الأقسام</button>
    </div>
  </div>`;
}

// ==================== SCROLL TOP ====================
window.addEventListener('scroll', () => {
  document.getElementById('scrollTop').classList.toggle('show', window.scrollY > 400);
});

// ==================== INIT ====================
renderSections();
updateGlobalProgress();

// ==================== PWA ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
      if (location.protocol === 'http:' || location.protocol === 'https:') {
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      }
    }).catch(() => {});
  });
}

// ==================== INSTALL (mobile app) ====================
let __installEvt = null;
function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}
function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini/i.test(navigator.userAgent);
}
function showInstallBar() {
  if (!isMobile() || isStandalone()) return;
  if (localStorage.getItem('ncx_install_dismissed') === '1') return;
  const bar = document.getElementById('installBar');
  if (!bar) return;
  bar.classList.add('show');
  document.body.classList.add('install-show');
}
function hideInstallBar() {
  const bar = document.getElementById('installBar');
  if (bar) bar.classList.remove('show');
  document.body.classList.remove('install-show');
}
function dismissInstall() {
  localStorage.setItem('ncx_install_dismissed', '1');
  hideInstallBar();
}
function installApp() {
  if (__installEvt) {
    __installEvt.prompt();
    __installEvt.userChoice.then(() => { __installEvt = null; hideInstallBar(); }).catch(() => {});
    return;
  }
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    document.getElementById('installModal').classList.add('show');
    return;
  }
  showToast('افتح قائمة المتصفح ⋮ واختر «تثبيت التطبيق»');
}
function closeInstallModal() {
  const m = document.getElementById('installModal');
  if (m) m.classList.remove('show');
}
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  __installEvt = e;
  showInstallBar();
});
window.addEventListener('appinstalled', () => {
  localStorage.setItem('ncx_install_dismissed', '1');
  hideInstallBar();
});
showInstallBar();
