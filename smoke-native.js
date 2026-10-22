const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const out = { errors: [] };
const done = () => { fs.writeFileSync(path.join(__dirname, 'smoke-native.json'), JSON.stringify(out, null, 2)); app.quit(); };
const J = v => 'JSON.stringify(' + v + ')';
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false, webPreferences: { backgroundThrottling: false } });
  win.webContents.on('render-process-gone', () => { out.errors.push('render gone'); done(); });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.once('did-finish-load', async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const js = c => win.webContents.executeJavaScript('(function(){ try { return JSON.stringify({ v: (()=>{ ' + c + ' })() }); } catch(e){ return JSON.stringify({ e: String(e&&e.message||e) }); } })()', true).then(JSON.parse);
    try {
      await wait(900);

      await js(`
        window.__expected = '';
        window.__startOpts = null;
        window.__calls = [];
        const mk = () => ({
          available(){ window.__calls.push('available'); return Promise.resolve({available:true}); },
          requestPermissions(){ window.__calls.push('perm'); return Promise.resolve({speechRecognition:'granted'}); },
          addListener(ev, cb){ window.__calls.push('listen:'+ev); if(ev==='partialResults') window.__pcb=cb; if(ev==='listeningState') window.__scb=cb; return Promise.resolve({remove(){}}); },
          start(o){ window.__calls.push('start'); window.__startOpts=o; setTimeout(()=>{ if(window.__pcb) window.__pcb({matches:[window.__expected]}); },40); setTimeout(()=>{ if(window.__scb) window.__scb({status:'stopped'}); },120); return Promise.resolve(); },
          stop(){ window.__calls.push('stop'); return Promise.resolve(); }
        });
        window.Capacitor = { isNativePlatform: ()=>true, Plugins: { SpeechRecognition: mk() }, registerPlugin: ()=>{ window.__calls.push('register'); return mk(); } };
        openSection(17);
        window.__expected = voiceQs ? voiceQs[0].it : '';
        setMode('voice');
        return typeof speechSupported();
      `);
      await wait(400);
      out.caseA_supported = (await js(`return speechSupported();`)).v;
      out.caseA_voiceCard = (await js(`return !!document.querySelector('.vv-word');`)).v;
      out.caseA_expected = (await js(`return window.__expected;`)).v;
      await js(`document.getElementById('vvMic').click(); return 1;`);
      await wait(700);
      out.caseA_pct = (await js(`return (document.querySelector('.vv-pct')||{}).textContent || '';`)).v;
      out.caseA_startOpts = (await js(`return window.__startOpts;`)).v;
      out.caseA_calls = (await js(`return window.__calls;`)).v;
      out.caseA_toast = (await js(`return (document.querySelector('.toast')||{}).textContent || '';`)).v;

      out.caseB = (await js(`
        window.__reg = [];
        window.Capacitor = { isNativePlatform: ()=>true, Plugins: {}, registerPlugin: (n)=>{ window.__reg.push(n); return { available:()=>Promise.resolve({available:true}) }; } };
        return { supported: speechSupported(), reg: window.__reg, hasSR: !!nativeSR() };
      `)).v;
      out.fnErrors = (await js(`return window.__errs || [];`)).v;
    } catch (e) { out.errors.push('thrown: ' + String(e && e.message || e)); }
    done();
  });
});
