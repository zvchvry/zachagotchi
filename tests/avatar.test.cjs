const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const avatar=require('../dist/avatar.js');
test('every appearance combination is bounded, monochrome, and works awake/asleep',()=>{
 let count=0;for(let hair=0;hair<6;hair++)for(let beard=0;beard<5;beard++)for(let shirt=0;shirt<4;shirt++)for(let pants=0;pants<4;pants++)for(const asleep of [false,true]){
 const pixels=avatar.pixels({...avatar.defaults,hair,beard,shirt,pants},asleep);assert.equal(pixels.length,1024);assert.ok(pixels.every(p=>p===0||p===1));assert.ok(pixels.some(p=>p===1));count++;
 }assert.equal(count,960);
});
test('all named options change the default art',()=>{
 for(const key of Object.keys(avatar.options)){const seen=new Set();for(let i=0;i<avatar.options[key].length;i++)seen.add(avatar.pixels({...avatar.defaults,[key]:i}).join(''));assert.equal(seen.size,avatar.options[key].length,key);}
});
test('firmware art matches browser pixels for all combinations',()=>{
 const source=fs.readFileSync('firmware/Zachagotchi/avatar-art.h','utf8');
 const tables=[...source.matchAll(/=\{([\s\S]*?)\};/g)].map(m=>JSON.parse('['+m[1].replaceAll('{','[').replaceAll('}',']')+']'));
 const [heads,bodies,hats]=tables;assert.equal(heads.length,60);assert.equal(bodies.length,16);assert.equal(hats.length,2);
 for(let hair=0;hair<6;hair++)for(let beard=0;beard<5;beard++)for(let shirt=0;shirt<4;shirt++)for(let pants=0;pants<4;pants++)for(let sleep=0;sleep<2;sleep++){
 const expected=avatar.pixels({...avatar.defaults,hair,beard,shirt,pants},!!sleep),h=heads[(hair*5+beard)*2+sleep],b=bodies[shirt*4+pants];
 for(let i=0;i<1024;i++)assert.equal(!!expected[i],!!((h[i>>3]|b[i>>3])&(0x80>>(i&7))));
 }
 for(const hat of [false,true]){const expected=avatar.hatPixels({...avatar.defaults,hat}),packed=hats[hat?1:0];for(let i=0;i<1024;i++)assert.equal(!!expected[i],!!(packed[i>>3]&(0x80>>(i&7))));}
});
test('appearance journals recover from corrupt newest slot; care records stay untouched',()=>{
 const data=new Map([['zachagotchi-save-a','care']]);const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const store=avatar.createStore(()=>storage);assert.deepEqual(store.load(),avatar.defaults);
 assert.ok(store.save({...avatar.defaults,name:'ava'}));assert.ok(store.save({...avatar.defaults,name:'sam'}));
 data.set('zachagotchi-avatar-b','broken');assert.equal(avatar.createStore(()=>storage).load().name,'ava');assert.equal(data.get('zachagotchi-save-a'),'care');
 assert.equal(store.save({...avatar.defaults,name:'<script>'}),false);assert.equal(store.save({...avatar.defaults,name:''}),false);assert.equal(store.save({...avatar.defaults,hair:99}),false);
});
test('muted sound creates no audio context; effects have bounded durations and stop',()=>{
 let contexts=0,started=0,stopped=0;const ends=[];
 class AudioContext{constructor(){contexts++;this.state='running';this.currentTime=0;this.destination={};}createOscillator(){return{frequency:{},connect(){},disconnect(){},start(){started++;},stop(at){stopped++;ends.push(at);}};}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}}
 const scope=vm.createContext({AudioContext});vm.runInContext(fs.readFileSync('dist/sound.js','utf8'),scope);
 vm.runInContext("var player=ZachSound.create();player.play('feed',false)",scope);assert.equal(contexts,0);
 vm.runInContext("player.play('play',true)",scope);assert.equal(contexts,1);assert.equal(started,4);assert.ok(ends.every(t=>t<=.36));
 vm.runInContext('player.stop()',scope);assert.equal(stopped,8);
});

test('only Classic head is rendered, including old saved size preferences',()=>{
 assert.equal(avatar.options.head,undefined);
 const classic=avatar.pixels(avatar.defaults);
 for(const head of [0,1,2,99])assert.deepEqual(avatar.pixels({...avatar.defaults,head}),classic);
 const legacy=JSON.stringify({version:1,sequence:1,profile:{...avatar.defaults,head:2,name:'alex'}});
 const store=avatar.createStore(()=>({getItem:key=>key.endsWith('-a')?legacy:null}));
 assert.equal(store.load().head,1);assert.equal(store.load().name,'alex');
});
test('hat is optional, monochrome, and legacy profiles load with it off',()=>{
 const off=avatar.pixels({...avatar.defaults,hat:false}),on=avatar.pixels({...avatar.defaults,hat:true});
 assert.notDeepEqual(on,off);assert.ok(on.every(p=>p===0||p===1));
 const legacy={...avatar.defaults};delete legacy.hat;
 const store=avatar.createStore(()=>({getItem:key=>key.endsWith('-a')?JSON.stringify({version:1,sequence:1,profile:legacy}):null}));
 assert.equal(store.load().hat,false);
});
test('every hair, facial-hair and shirt combination has an unbroken chin-to-shirt connection',()=>{
 for(let hair=0;hair<6;hair++)for(let beard=0;beard<5;beard++)for(let shirt=0;shirt<4;shirt++){
   const pixels=avatar.pixels({...avatar.defaults,hair,beard,shirt});
   // Follow the collar outline rather than treating its paper-colored opening as a gap.
   const pending=[[12,18]],seen=new Set();let connected=false;
   while(pending.length){const [x,y]=pending.pop(),key=y*32+x;if(x<0||x>=32||y<16||y>=32||seen.has(key)||!pixels[key])continue;seen.add(key);if(y===26){connected=true;break;}pending.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);}
   assert.ok(connected,`detached head for hair ${hair}, beard ${beard}, shirt ${shirt}`);
 }
});

test('default sprite exactly matches the user reference, with no added pixel rows',()=>{
 const reference=require('./fixtures/original-zach-sleeping.json');
 const expected=Uint8Array.from(reference.join(''),pixel=>pixel==='#'?1:0);
 assert.deepEqual(avatar.pixels(avatar.defaults,true),expected);
 // Awake uses the original open eyes, with the rest of the silhouette unchanged.
 for(let y=9;y<=10;y++)for(let x=10;x<=22;x++)expected[y*32+x]=0;
 for(const x of [12,13,19,20])for(const y of [9,10])expected[y*32+x]=1;
 assert.deepEqual(avatar.pixels(avatar.defaults,false),expected);
});
