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
  currentMode = mode;
  ['modeList', 'modeFlash', 'modeGrid'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('mode' + mode.charAt(0).toUpperCase() + mode.slice(1)).classList.add('active');
  flashIndex = 0;
  flashRevealed = false;
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
