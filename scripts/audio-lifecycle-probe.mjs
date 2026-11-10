import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Isolated native-browser audio lifetime probe. Never edits application source.
const variant = process.argv[2] || 'original';
const cycles = Number(process.argv[3] || 3);
const durationMs = Number(process.argv[4] || 6000);
const port = 5189;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'], {windowsHide:true,stdio:'pipe'});
let browser;
try {
  // Wait for our own strict-port server, never attach to another process on 5189.
  await new Promise((resolve,reject)=>{
    let output='';
    const timeout=setTimeout(()=>reject(new Error(`Vite startup timed out: ${output}`)),10000);
    server.on('error',error=>{clearTimeout(timeout);reject(error);});
    server.on('exit',code=>{clearTimeout(timeout);reject(new Error(`Vite exited (${code}): ${output}`));});
    const read=chunk=>{output+=chunk.toString();if(output.includes(`http://127.0.0.1:${port}`)){clearTimeout(timeout);resolve();}};
    server.stdout.on('data',read);server.stderr.on('data',read);
  });
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  if(variant==='null-onended') {
    await page.route('**/src/game/audio/audio.ts',async route=>{
      const response=await route.fetch(); const body=await response.text();
      if(!body.includes('osc.onended = () => {')) throw new Error('Probe replacement target missing');
      await route.fulfill({response,body:body.replace('osc.onended = () => {','osc.onended = () => { osc.onended = null;')});
    });
  }
  await page.addInitScript(()=>{
    const proto=AudioContext.prototype;
    window.audioProbeRefs=[];window.audioProbeCreated={osc:0,gain:0};window.audioProbeEnded=0;
    for(const [method,kind] of [['createOscillator','osc'],['createGain','gain']]) {
      const original=proto[method];
      proto[method]=function(...args) {
        const node=original.apply(this,args);
        window.audioProbeCreated[kind]++;
        window.audioProbeRefs.push({kind,ref:new WeakRef(node)});
        if(kind==='osc') node.addEventListener('ended',()=>window.audioProbeEnded++,{once:true});
        return node;
      };
    }
  });
  await page.goto(`http://127.0.0.1:${port}/?test`);
  await page.getByRole('button',{name:'开启冒险',exact:true}).click();
  await page.evaluate(async()=>{
    window.audioProbeEngine=(await import('/src/game/audio/audio.ts')).audio;
    window.__game.game.loop.stop(); // No rendering benchmark; keep independent probe CPU low.
    window.audioProbeEngine.stopAll();
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  const records=[];
  async function sample(label,gc=false,wait=0){
    if(gc)await cdp.send('HeapProfiler.collectGarbage');
    if(wait)await page.waitForTimeout(wait);
    const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
    const state=await page.evaluate(()=>{
      const live={osc:0,gain:0,endedWithHandler:0};
      for(const item of window.audioProbeRefs){const node=item.ref.deref();if(node){live[item.kind]++;if(item.kind==='osc'&&node.onended)live.endedWithHandler++;}}
      return {diagnostics:window.audioProbeEngine.diagnostics(),created:window.audioProbeCreated,ended:window.audioProbeEnded,weakLive:live};
    });
    const row={label,gc,wait,AudioHandlers:metrics.AudioHandlers,JSHeapUsedSize:metrics.JSHeapUsedSize,JSEventListeners:metrics.JSEventListeners,Nodes:metrics.Nodes,...state};
    records.push(row);console.log(JSON.stringify(row));
  }
  await sample('initial-stop-wait-gc',true,750);
  for(let cycle=0;cycle<cycles;cycle++) {
    await page.evaluate(async ({cycle,durationMs})=>{
      const a=window.audioProbeEngine,s=window.__game.scene;
      s.loadLevel(cycle+1);
      const interval=setInterval(()=>{a.play('coin');a.play('jump');},90);
      const power=setInterval(()=>a.play('power'),400);
      await new Promise(r=>setTimeout(r,durationMs));
      clearInterval(interval);clearInterval(power);
    },{cycle,durationMs});
    await sample(`cycle-${cycle+1}-playing`);
    await sample(`cycle-${cycle+1}-playing-gc-immediate`,true);
    await sample(`cycle-${cycle+1}-playing-gc-after-200ms`,false,200);
    await page.evaluate(()=>window.audioProbeEngine.stopAll());
    await sample(`cycle-${cycle+1}-stopped-wait`,false,1000);
    await sample(`cycle-${cycle+1}-stopped-gc-immediate`,true);
    await sample(`cycle-${cycle+1}-stopped-gc-after-300ms`,false,300);
  }
  await sample('final-wait-3s',false,3000);
  await sample('final-gc-1',true,500);
  await sample('final-gc-2',true,500);
  await page.evaluate(()=>window.audioProbeEngine.context.close());
  await sample('context-close-gc',true,1000);
  await sample('context-close-gc-2',true,500);
  const recovered=records.filter(r=>r.label.endsWith('stopped-gc-after-300ms'));
  const result={variant,cycles,durationMs,browser:browser.version(),note:'Native Web Audio music/SFX loads, stop, wait and forced GC; render loop stopped to isolate audio. WeakRefs are observational only. null-onended variant changes HTTP module response in memory only.',
    conditions:{port,stopWaitMs:1000,gcThenWaitMs:300,finalIdleMs:3000,doubleGcWaitMs:500},
    interpretation:'AudioHandlers counts live native instances, not total allocations. Native destruction may complete after the GC command returns. Retained engine buses/compressor/destination account for four idle handlers.',
    sources:['https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webaudio/audio_handler.cc','https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/inspector/inspector_performance_agent.cc'],
    recovery:recovered.map(r=>({label:r.label,AudioHandlers:r.AudioHandlers,JSEventListeners:r.JSEventListeners,diagnostics:r.diagnostics,weakLive:r.weakLive})),records,errors};
  await writeFile(`artifacts/upgrade/after/audio-lifecycle${variant==='original'?'':`-${variant}`}.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({completed:true,variant,recovery:result.recovery,errors}));
} finally { await browser?.close();server.kill(); }
