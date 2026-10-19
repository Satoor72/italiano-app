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
  document.getElementById('wordsView').classList.add('active');
  document.getElementById('wordSearch').value = '';

  document.getElementById('wordsHeader').innerHTML = `
    <div class="w-emoji">${currentSection.emoji}</div>
    <div class="w-info">
      <h2>${currentSection.title}</h2>
      <div class="w-it">${currentSection.italian} — ${currentSection.words.length} كلمة</div>
    </div>
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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
