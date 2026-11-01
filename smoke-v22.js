const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const out = { errors: [] };
const done = () => { fs.writeFileSync(path.join(__dirname, 'smoke-v22.json'), JSON.stringify(out, null, 2)); app.quit(); };
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1400, height: 900, show: false, webPreferences: { backgroundThrottling: false } });
  win.webContents.on('console-message', (e, l, m) => { if (m && /error/i.test(m) && !/CSP|Security Warning/i.test(m)) out.errors.push(String(m).slice(0, 150)); });
  win.webContents.on('render-process-gone', () => { out.errors.push('render gone'); done(); });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.once('did-finish-load', async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const js = c => win.webContents.executeJavaScript('(function(){try{return JSON.stringify({v:(()=>{ ' + c + ' })()})}catch(e){return JSON.stringify({e:String(e&&e.message||e)})}})()', true).then(JSON.parse);
    try {
      await wait(1000);
      out.v22 = (await js(`return document.querySelectorAll('[href*="?v=22"],[src*="?v=22"]').length;`)).v;
      out.sections = (await js(`return ALL_DATA.length;`)).v;
      out.total = (await js(`return totalWords();`)).v;
      out.sec17 = (await js(`return ALL_DATA.find(s=>s.id===17).words.length;`)).v;
      out.igExists = (await js(`return !!document.getElementById('igLink');`)).v;
      out.igPos = (await js(`const b=document.getElementById('igLink').getBoundingClientRect(); const cs=getComputedStyle(document.getElementById('igLink')); return {left:Math.round(b.left), bottom:Math.round(window.innerHeight-b.bottom), w:Math.round(b.width), pos:cs.position, z:cs.zIndex};`)).v;
      out.scrollTopBottom = (await js(`return getComputedStyle(document.getElementById('scrollTop')).bottom;`)).v;
      out.audio17 = (await js(`const s=ALL_DATA.find(x=>x.id===17); return s.words.filter(w=>window.AUDIO_INDEX[w[0]]).length+'/'+s.words.length;`)).v;
      await js(`openSection(17); return 1;`);
      await wait(500);
      out.sec17Rendered = (await js(`return document.getElementById('modeContent').textContent.includes('Acqua naturale o frizzante?');`)).v;
      out.voiceFns = (await js(`return [typeof startVoiceListeningNative, typeof voiceEngineLabel, typeof renderVoiceEnd].join(',');`)).v;
      out.fnErrors = (await js(`return window.__errs || [];`)).v;
    } catch (e) { out.errors.push('thrown: ' + String(e && e.message || e)); }
    done();
  });
});
