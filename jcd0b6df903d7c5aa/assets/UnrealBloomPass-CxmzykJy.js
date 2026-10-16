import{A as e,C as t,M as n,N as r,O as i,P as a,S as o,T as s,_ as c,a as l,b as u,f as d,g as f,i as p,n as m,o as ee,r as te,s as h,t as g,v as _}from"./esm-TD82earp.js";import{Ar as v,Er as y,Et as ne,G as b,Pn as x,R as S,Rt as re,Tr as C,Tt as ie,Yn as w,dr as T,g as E,gr as D,h as O,u as ae}from"./SkeletonUtils-Be-XVruE.js";import{n as k}from"./polish-CcIGVH9b.js";import{a as A,n as oe,o as se,s as j}from"./volumes-ASfafPSi.js";import{t as ce}from"./player-BlnwgR17.js";var M={rt60:1.6,bright:2500,wet:.25,level:2.45};function le(e,t,n){let r=e.sampleRate,i=Math.floor(.01*r),a=i+Math.floor(r*t),o=e.createBuffer(2,a,r),s=1-Math.exp(-2*Math.PI*n/r),c=11,l=()=>(c=c*16807%2147483647)/2147483647*2-1;for(let e=0;e<2;e++){let n=o.getChannelData(e),c=0;for(let e=i;e<a;e++){let a=(e-i)/r;c+=s*(l()-c),n[e]=c*10**(-3*a/t)}}return o}function N(e,t=n()){let r=new i(1),o=M.wet*Math.PI/2;r.connect(new i(Math.cos(o)).connect(e));let s=new l({normalize:!0});return s.buffer=new a(le(t.rawContext,M.rt60,M.bright)),r.chain(new i(Math.sin(o)*M.level),s),s.connect(e),r}var P=class{out;now;buffers=new Map;last=new Map;loop=null;cap=1/0;sounding=new Map;constructor(e,t=()=>p()){this.out=e,this.now=t}async load(){let e=`./sfx/`,t;try{t=await(await fetch(`${e}sfx.json`)).json()}catch{return}let r=n();await Promise.all(Object.entries(t).map(async([t,n])=>{let i=[];for(let t of n.files)try{let n=await(await fetch(e+t)).arrayBuffer();i.push(await r.decodeAudioData(n))}catch{}i.length&&this.buffers.set(t,i)}))}has(e){return this.buffers.has(e)}play(t,r=1,i=.05,a=40,o=0){let s=this.buffers.get(t);if(!s)return!1;let c=performance.now();if(c-(this.last.get(t)??-1e9)<a)return!0;this.last.set(t,c);let l=this.sounding.get(t)??0;if(l>=this.cap)return!0;this.sounding.set(t,l+1);let u=n(),d=u.createBufferSource();d.buffer=s[Math.floor(Math.random()*s.length)],d.playbackRate.value=1+(Math.random()*2-1)*i;let f=u.createGain();return f.gain.value=r,d.connect(f),e(f,this.out),d.start(this.now()+o),d.onended=()=>{f.disconnect(),this.sounding.set(t,Math.max(0,(this.sounding.get(t)??1)-1))},!0}loopAt(t,r){let i=n();if(r<=.001){this.loop&&this.loop.gain.gain.setTargetAtTime(0,i.currentTime,.15);return}if(!this.loop){let n=this.buffers.get(t);if(!n)return;let r=i.createBufferSource();r.buffer=n[0],r.loop=!0;let a=i.createGain();a.gain.value=0,r.connect(a),e(a,this.out),r.start(),this.loop={src:r,gain:a}}this.loop.gain.gain.setTargetAtTime(r,i.currentTime,.2)}},F=e=>440*2**((e-69)/12),I=60,L=[0,4,7,12,16,19,24,28,31,36],R=e=>I+L[Math.min(L.length-1,Math.max(0,e))],z=.06,B=[.55,.75,.95],V={putter:{name:`swing-short`,peak:.07,volume:.35,lead:.145},wedge:{name:`swing-short`,peak:.07,volume:.7,lead:.13},iron:{name:`swing`,peak:.07,volume:.75,lead:.095},driver:{name:`swing-big`,peak:.078,volume:.85,lead:.095}},H=2.2,U={skeleton:`hit-bone`,knight:`hit-armor`,stoneling:`hit-stone`,golem:`hit-stone`,wraith:`hit-soft`};function ue(e){let t=.85,n=Math.abs(e);return n<=t?e:Math.sign(e)*(t+.14*Math.tanh((n-t)/.14))}var W=`gk-music-muted`,G=`gk-all-muted`;function K(e=W){try{return localStorage.getItem(e)===`1`}catch{return!1}}var de=class{master;limiter;musicBus;click;thudSynth;boom;noise;whooshNoise;whooshFilter;zapSynth;bell;growlSynth;horn;music=new ce(()=>this.ready?this.musicBus:null);chargeSynth;killBell;bank=null;killAt=0;killTimes=[];released=null;swingLead=new Map;musicDown=!1;defeatTimer=null;verb;out;ready=!1;muted=K();allMuted=K(G);lastPlayed=new Map;quietWorld=!1;probe=null;asked=new Map;lastTime=new Map;constructor(){for(let e of`chargeTick.duff.whoosh.tock.thud.kill.bounce.explosion.zap.frost.growl.gateHit.hurt.waveHorn.victory.defeat.unlock.death.eliteAlert.bossAppear.bossThrow.bossRock.bubblePop.bubbleUp.armorHit.ricochet.phaseBounce.heal.dodge.dodgeReady.casterCast.casterHit.burnTick.burning.waveClear.cardAppear.cardPick.uiClick.playerDies.hole.cast.trample.ballHit.groan.meleeHit.hush.preview.previewGroup`.split(`.`)){let t=this[e].bind(this);this[e]=(...n)=>{try{t(...n)}catch(t){console.warn(`audio ${e}:`,t)}}}}at(e,t=0){let n=Math.max(this.now()+t,(this.lastTime.get(e)??0)+.03);return this.lastTime.set(e,n),n}now(){return k(`onTime`)?te():p()}ok(e,t=50){if(!this.ready)return!1;let n=performance.now();return n-(this.lastPlayed.get(e)??-1e9)<t?!1:(this.lastPlayed.set(e,n),!0)}async start(){await r(),g().mute=this.allMuted;let e=k(`mix`),n=k(`mixGuard`);if(this.limiter=e&&n?new h({threshold:-8,ratio:4,knee:6,attack:.005,release:.25}):e?new h({threshold:-3,ratio:20,knee:0,attack:.002,release:.15}):new ee(-1),n){let e=new s(e=>ue(2*e),4096);e.oversample=`2x`,this.limiter.chain(new i(.5),e,g()),this.out=e}else this.limiter.toDestination(),this.out=this.limiter;this.master=new i(A.todo).connect(n?new i(.8).connect(this.limiter):this.limiter);let a=N(this.master);this.verb=a,this.musicBus=new i(this.musicLevel()).connect(a),this.click=new _({pitchDecay:.008,octaves:2,envelope:{attack:.001,decay:.07,sustain:0,release:.02},volume:-4}).connect(this.master),this.thudSynth=new _({pitchDecay:.05,octaves:4,envelope:{attack:.001,decay:.2,sustain:0,release:.1},volume:-8}).connect(this.master),this.boom=new _({pitchDecay:.12,octaves:7,envelope:{attack:.001,decay:.6,sustain:0,release:.3},volume:-3}).connect(this.master),this.noise=new c({noise:{type:`brown`},envelope:{attack:.005,decay:.35,sustain:0,release:.1},volume:-8}),this.noise.chain(new o(1200,`lowpass`),this.master),this.whooshFilter=new o(900,`bandpass`),this.whooshNoise=new c({noise:{type:`pink`},envelope:{attack:.04,decay:.14,sustain:0,release:.08},volume:-10}),this.whooshNoise.chain(this.whooshFilter,this.master),this.zapSynth=new t({oscillator:{type:`sawtooth`},envelope:{attack:.001,decay:.12,sustain:0,release:.05},volume:-14}),this.zapSynth.chain(new o(3e3,`highpass`),a),this.bell=new f(t,{oscillator:{type:`sine`},envelope:{attack:.002,decay:.5,sustain:0,release:.4},volume:-12}).connect(a);let l=new d(.6);l.chain(new o(420,`lowpass`),this.master),this.growlSynth=new t({oscillator:{type:`sawtooth`},envelope:{attack:.02,decay:.1,sustain:.7,release:.12},volume:-16}).connect(l),this.horn=new f(t,{oscillator:{type:`sawtooth`},envelope:{attack:.08,decay:.2,sustain:.8,release:.5},volume:-16}),this.horn.chain(new o(900,`lowpass`),a),this.chargeSynth=new t({oscillator:{type:`triangle`},envelope:{attack:.002,decay:.16,sustain:0,release:.08},volume:-11}).connect(a),this.killBell=new f(u,{harmonicity:2,modulationIndex:5,envelope:{attack:.002,decay:.7,sustain:0,release:.6},modulationEnvelope:{attack:.002,decay:.15,sustain:0,release:.1},volume:-9}).connect(a);let p=new i(e?.6:.9).connect(this.master);this.bank=new P(p,()=>this.now()),k(`mixGuard`)&&(this.bank.cap=3),this.bank.load(),this.ready=!0}sample(e,t,n=1,r=.05,i=40,a=0){return!this.ready||!this.bank||!k(e)?!1:(this.asked.set(t,n),this.bank.play(t,n*j(t),r,i,a))}hasSample(e,t){return this.ready&&!!this.bank&&k(e)&&this.bank.has(t)}chargeTick(e){this.ready&&this.chargeSynth.triggerAttackRelease(F(R(e-1)),.09,this.at(this.chargeSynth),.75*A.carga)}startMusic(){m().start(),this.music.refresh()}musicLevel(){return this.muted||this.musicDown?0:.8*A.musica}applyVolumes(){this.ready&&(this.master.gain.rampTo(A.todo,.05),this.musicBus.gain.rampTo(this.musicLevel(),.05),this.music.applyVolume())}preview(e){if(this.ready&&this.bank){if(e===`burn-loop`){this.bank.loopAt(e,.2*j(e)),setTimeout(()=>this.bank?.loopAt(e,0),1500);return}this.bank.play(e,(this.asked.get(e)??.6)*j(e),0,0)}}previewGroup(e){if(!this.ready)return;if(e===`carga`){[1,2,3].forEach(e=>setTimeout(()=>this.chargeTick(e),e*220));return}if(e===`bajas`){[0,1,2,3].forEach(e=>this.kill(e));return}let t=oe.find(t=>e===`todo`||se(t)===e);t&&this.preview(t)}toggleMute(){this.muted=!this.muted,this.musicBus.gain.rampTo(this.musicLevel(),.2);try{localStorage.setItem(W,this.muted?`1`:`0`)}catch{}return this.muted}toggleAll(){this.allMuted=!this.allMuted,this.ready&&(g().mute=this.allMuted);try{localStorage.setItem(G,this.allMuted?`1`:`0`)}catch{}return this.allMuted}pause(){m().pause()}resume(){m().start()}whoosh(e,t=``){if(!this.ok(`whoosh`))return;let n=V[t];if(n&&this.hasSample(`swing`,n.name)){this.released={at:this.now(),club:t};let r=this.swingLead.get(t)??n.lead;this.sample(`swing`,n.name,n.volume*(.55+.45*e),.03,40,Math.max(0,r-n.peak));return}this.whooshFilter.frequency.value=600+1600*e,this.whooshNoise.triggerAttackRelease(.2,this.at(this.whooshNoise),A.palo)}duff(){if(!this.ok(`duff`,150)||this.sample(`samples`,`duff`,.8))return;let e=this.at(this.growlSynth);this.growlSynth.triggerAttackRelease(220,.32,e),this.growlSynth.frequency.exponentialRampToValueAtTime(90,e+.32)}tock(e,t=0,n=``){if(this.released?.club===n){let e=this.now()-this.released.at;e>.02&&e<.8&&this.swingLead.set(n,.5*(this.swingLead.get(n)??e)+.5*e),this.released=null}if(t===0&&this.defeatTimer||!this.ok(`tock`))return;if(t>=1&&n&&this.sample(`samples`,`club-${n}`,B[Math.min(3,t)-1],.04)){e&&this.sample(`samples`,`perfect`,.7,.02,40,.03);return}let r=this.at(this.click);this.click.triggerAttackRelease(e?`G4`:`D4`,`32n`,r,A.palo),e&&this.bell.triggerAttackRelease([F(86),F(91)],.4,r+.02,A.palo)}thud(){this.ok(`thud`)&&(this.sample(`samples`,`hit-soft`,.6,.08)||this.thudSynth.triggerAttackRelease(`A1`,`16n`,this.at(this.thudSynth),A.golpes))}ballHit(e,t,n){if(n){this.armorHit();return}if(!this.ok(`ballHit`,35))return;let r=U[e]??(t>=3?`hit-heavy`:`ball-hit`);this.sample(`samples`,r,t>=3?.85:.7,.06,35)||this.thudSynth.triggerAttackRelease(`A1`,`16n`,this.at(this.thudSynth),A.golpes)}groan(e,t,n){if(!this.quietWorld){if(n){this.sample(`groans`,`hurt-golem`,.7,.04,400,.05);return}if(t){this.sample(`groans`,`elite-hurt`,.8,.04,220,.05);return}this.ok(`groan`,70)&&this.sample(`groans`,`hurt-${e}`,.42,.08,110,.05)}}kill(e){if(!this.ready)return;let t=Math.max(this.now(),this.killAt+z);this.killAt=t,this.killTimes=this.killTimes.filter(e=>e>t-.6),this.killTimes.push(t);let n=k(`mixGuard`)?Math.sqrt(4/Math.max(4,this.killTimes.length)):1;this.killBell.triggerAttackRelease(F(R(e)),.5,t,n*Math.min(1,.6+.06*e)*A.bajas)}bounce(){this.ok(`bounce`)&&this.click.triggerAttackRelease(`A2`,`64n`,this.at(this.click),.35*A.golpes)}explosion(e=!1){!this.quietWorld&&this.ok(`explosion`,120)&&(this.sample(`samples`,e?`explosion-big`:`explosion-small`,e?.7:.55,.06)||(this.boom.triggerAttackRelease(`C1`,`4n`,this.at(this.boom),A.explosiones),this.noise.triggerAttackRelease(.4,this.at(this.noise),A.explosiones)))}zap(){if(!this.ok(`zap`)||this.sample(`samples`,`lightning-chain`,.6,.06))return;let e=this.at(this.zapSynth);this.zapSynth.triggerAttackRelease(1800,.12,e),this.zapSynth.frequency.exponentialRampToValueAtTime(300,e+.12)}frost(){this.ok(`frost`)&&(this.sample(`samples`,`ice`,.7)||this.bell.triggerAttackRelease([F(88),F(95),F(100)],.5,this.now(),.6))}growl(){if(this.quietWorld||!this.ok(`growl`,120))return;let e=this.at(this.growlSynth);this.growlSynth.triggerAttackRelease(80,.22,e),this.growlSynth.frequency.exponentialRampToValueAtTime(52,e+.22)}gateHit(){!this.quietWorld&&this.ok(`gateHit`,120)&&(this.sample(`samples`,`gate-hit`,.85)||this.boom.triggerAttackRelease(`E1`,`8n`,this.at(this.boom),.7*A.golfista))}hurt(){!this.quietWorld&&this.ok(`hurt`)&&(this.sample(`samples`,`hurt`,.85)||this.thudSynth.triggerAttackRelease(`E2`,`8n`,this.at(this.thudSynth),A.golfista))}waveHorn(){if(!this.ok(`waveHorn`))return;let e=this.now();this.horn.triggerAttackRelease([F(50),F(57)],.7,e),this.horn.triggerAttackRelease([F(53),F(60)],1,e+.75)}victory(){if(this.sample(`samples`,`victory`,.8,0))return;let e=this.now();[62,66,69,74].forEach((t,n)=>this.bell.triggerAttackRelease(F(t+12),.6,e+n*.16))}unlock(e){if(!this.ready)return;let t=this.now();this.boom.triggerAttackRelease(e?`A0`:`C1`,`2n`,this.at(this.boom)),this.noise.triggerAttackRelease(.7,this.at(this.noise));let n=e?36:38;this.horn.triggerAttackRelease([n,n+7,n+12,n+15].map(F),e?2.4:1.6,t+.04),[0,3,7,12].forEach((e,r)=>this.bell.triggerAttackRelease(F(n+36+e),.5,t+.18+r*.09,.7))}defeat(e){if(e&&this.ready&&k(`defeatPause`)){this.musicDown=!0,this.musicBus.gain.rampTo(0,.3),e===`gate`?this.sample(`samples`,`gate-fall`,1,0,500):this.sample(`samples`,`knight-groan`,1,.02,500),this.defeatTimer&&clearTimeout(this.defeatTimer),this.defeatTimer=setTimeout(()=>{this.defeatTimer=null,this.defeatTheme()},H*1e3);return}this.defeatTheme()}defeatTheme(){if(this.sample(`samples`,`defeat`,.8,0))return;let e=this.now();[57,53,50].forEach((t,n)=>this.horn.triggerAttackRelease(F(t-12),.8,e+n*.45))}death(e){e===`golem`?this.sample(`voices`,`boss-death`,.9,0,500):this.sample(`voices`,`death-${e}`,.6,.07,90)}eliteAlert(){this.sample(`voices`,`elite-alert`,.8,0,500)}bossAppear(){this.sample(`voices`,`boss-appear`,.9,0,1e3)}bossThrow(){this.quietWorld||this.sample(`voices`,`boss-throw`,.7,.05,300)||this.growl()}bossRock(){this.quietWorld||this.sample(`voices`,`boss-rock`,.8,.05,150)}bubblePop(){this.sample(`powerSounds`,`bubble-pop`,.75,.06,60)||this.bounce()}bubbleUp(){this.sample(`powerSounds`,`bubble-up`,.45,.05,120)}armorHit(){this.sample(`powerSounds`,`armor-hit`,.7,.08,50)||this.thud()}ricochet(){this.sample(`powerSounds`,`ricochet`,.65,.08,50)||this.bounce()}phaseBounce(){this.sample(`powerSounds`,`phase-bounce`,.65,.06,50)||this.bounce()}heal(){this.sample(`powerSounds`,`heal`,.5,.05,150)}dodge(){this.sample(`powerSounds`,`dodge`,.6,.08,60)||this.whoosh(.5)}dodgeReady(){this.sample(`powerSounds`,`dodge-ready`,.3,.05,150)}casterCast(){this.quietWorld||this.sample(`powerSounds`,`caster-cast`,.5,.06,120)||this.zap()}casterHit(){this.quietWorld||this.sample(`powerSounds`,`caster-hit`,.55,.06,80)}burnTick(){this.sample(`fireSounds`,`burn-tick`,.35,.12,90)}burning(e){if(!this.ready||!this.bank)return;let t=k(`fireSounds`)&&e>0;this.bank.loopAt(`burn-loop`,t?Math.min(.32,.12+.05*e)*j(`burn-loop`):0)}waveClear(){this.sample(`uiSounds`,`wave-clear`,.6,0,500)}cardAppear(e=0){this.sample(`uiSounds`,`card-appear`,.45,.04,30,e*.09)}cardPick(){this.sample(`uiSounds`,`card-pick`,.7,0,200)}uiClick(){this.sample(`uiSounds`,`ui-click`,.5,0,60)}playerDies(){this.sample(`samples`,`player-dies`,k(`defeatPause`)?1:.8,0,500)}hole(){return this.sample(`samples`,`hole`,.7,0,120)}cast(e){if(this.ok(`cast`,80)){if(e&&k(`abilitySounds`)){if(e.kind===`melee`||e.kind===`shot`&&this.sample(`abilitySounds`,`cast-${e.element}`,.55,.05,80,.02)||e.kind===`split`&&this.sample(`abilitySounds`,`cast-wind`,.5,.05,80,.02))return;if(e.kind===`glove`&&this.sample(`abilitySounds`,`cast-glove`,.6,0,200)){this.sample(`abilitySounds`,`cast-${e.element}`,.3,.05,80,.15);return}if(this.sample(`abilitySounds`,`cast-${e.kind}`,.6,.04,80))return}this.whoosh(.7)}}meleeHit(){this.sample(`abilitySounds`,`cast-melee`,.8,.05,100)||this.thud()}hush(e){this.quietWorld=e,!e&&this.defeatTimer&&(clearTimeout(this.defeatTimer),this.defeatTimer=null),!e&&this.musicDown&&(this.musicDown=!1,this.ready&&this.musicBus.gain.rampTo(this.musicLevel(),.5))}tap(){return this.ready?(this.probe||(this.probe=n().createAnalyser(),this.probe.fftSize=4096,e(this.out,this.probe)),this.probe):null}trample(){return this.sample(`samples`,`trample`,.6,.06,80)}willSample(e,t){return this.hasSample(e,t)}gainBell=null;powerGain(e,t=1,n=!0){try{if(this.quietWorld||!this.ok(`powerGain`,140))return;this.gainBell||(this.gainBell=new f(u,{harmonicity:1,modulationIndex:1.6,oscillator:{type:`sine`},modulation:{type:`sine`},envelope:{attack:.006,decay:.55,sustain:0,release:.5},modulationEnvelope:{attack:.004,decay:.2,sustain:0,release:.1},volume:-13}),this.gainBell.chain(new o(2600,`lowpass`),this.verb));let r={armor:[43,50,55],shield:[48,55,60],divine:[72,76,79,84],dodge:[69,76,81],regen:[65,69,72],heal:[65,69,72],ethereal:[62,69,74],phase:[62,69,74],skull:[40,43,47],banner:[58,65,70],warded:[64,71,76],ward:[64,71,76],stealth:[74,69,62]}[e]??[60,67],i=Math.max(0,Math.min(3,(t>=10?3:t)-1))*2,a=n?r.map(e=>e+i):[r[r.length-1]+i,r[0]+i],s=this.at(this.gainBell),c=e===`ethereal`||e===`phase`||e===`stealth`?.11:.07;if(a.forEach((e,t)=>this.gainBell.triggerAttackRelease(F(e),.22,s+t*c,n?.8-t*.08:.4)),!n)return;e===`armor`?this.sample(`powerSounds`,`armor-hit`,.32,.05,120):e===`shield`?this.thudSynth.triggerAttackRelease(`C2`,.1,this.at(this.thudSynth)):e===`divine`?this.sample(`powerSounds`,`bubble-up`,.35,.05,120):e===`dodge`?this.sample(`powerSounds`,`dodge-ready`,.4,.05,120):e===`regen`&&this.sample(`powerSounds`,`heal`,.3,.05,150)}catch(e){console.warn(`audio powerGain:`,e)}}},q={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},J=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},fe=new re(-1,1,1,-1,0,1),pe=new class extends ae{constructor(){super(),this.setAttribute(`position`,new S([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new S([0,2,0,0,2,0],2))}},Y=class{constructor(e){this._mesh=new ie(pe,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,fe)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},me=class extends J{constructor(e,t=`tDiffuse`){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof w?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=D.clone(e.uniforms),this.material=new w({name:e.name===void 0?`unspecified`:e.name,defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new Y(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},X=class extends J{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},he=class extends J{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},ge=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new C);this._width=n.width,this._height=n.height,t=new v(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:b}),t.texture.name=`EffectComposer.rt1`}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new me(q),this.copyPass.material.blending=0,this.timer=new T}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}X!==void 0&&(r instanceof X?n=!0:r instanceof he&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new C);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},Z={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},_e=class extends J{constructor(){super(),this.isOutputPass=!0,this.uniforms=D.clone(Z.uniforms),this.material=new x({name:Z.name,uniforms:this.uniforms,vertexShader:Z.vertexShader,fragmentShader:Z.fragmentShader}),this._fsQuad=new Y(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},E.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},Q=class extends J{constructor(e,t,n=null,r=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new O}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let i,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==1&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}},ve={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new O(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},$=class e extends J{constructor(e,t=1,n,r){super(),this.strength=t,this.radius=n,this.threshold=r,this.resolution=e===void 0?new C(256,256):new C(e.x,e.y),this.clearColor=new O(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new v(i,a,{type:b,depthBuffer:!1}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new v(i,a,{type:b,depthBuffer:!1});t.texture.name=`UnrealBloomPass.h`+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let n=new v(i,a,{type:b,depthBuffer:!1});n.texture.name=`UnrealBloomPass.v`+e,n.texture.generateMipmaps=!1,this.renderTargetsVertical.push(n),i=Math.round(i/2),a=Math.round(a/2)}let o=ve;this.highPassUniforms=D.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new w({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let s=[6,10,14,18,22];i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(s[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new C(1/i,1/a),i=Math.round(i/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new y(1,1,1),new y(1,1,1),new y(1,1,1),new y(1,1,1),new y(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=D.clone(q.uniforms),this.blendMaterial=new w({uniforms:this.copyUniforms,vertexShader:q.vertexShader,fragmentShader:q.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new O,this._oldClearAlpha=1,this._basic=new ne,this._fsQuad=new Y(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new C(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(t,n,r,i,a){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),a&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let s=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this._fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[n]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[n]),t.clear(),this._fsQuad.render(t),s=this.renderTargetsVertical[n];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(r),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);let r=[],i=[];for(let n=1;n<e;n+=2){let a=t[n],o=n+1<e?t[n+1]:0,s=a+o;r.push((n*a+(n+1)*o)/s),i.push(s)}return new w({defines:{KERNEL_PAIRS:r.length},uniforms:{colorTexture:{value:null},invSize:{value:new C(.5,.5)},direction:{value:new C(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:r},gaussianWeights:{value:i}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new w({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};$.BlurDirectionX=new C(1,0),$.BlurDirectionY=new C(0,1);export{de as a,ge as i,Q as n,_e as r,$ as t};