(function(root){
'use strict';
const tunes={feed:[523,659,784],love:[659,784,988],play:[523,784,659,1047],sleep:[659,523,392],wake:[392,523,784],save:[784,1047],tap:[880],coffee:[392,523,659,523]};
function create(){let context=null,active=[];function stop(){for(const node of active)try{node.stop();}catch{}active=[];}
return{stop,play(kind,enabled=true){if(!enabled)return;try{const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)return;context=context||new Audio();if(context.state==='suspended')context.resume().catch(()=>{});stop();const notes=tunes[kind]||tunes.tap,now=context.currentTime;notes.forEach((hz,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=now+i*.09;oscillator.type='square';oscillator.frequency.value=hz;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.025,at+.005);gain.gain.linearRampToValueAtTime(0,at+.075);oscillator.connect(gain);gain.connect(context.destination);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();active=active.filter(n=>n!==oscillator);};oscillator.start(at);oscillator.stop(at+.08);active.push(oscillator);});}catch{/* Audio failure never blocks care or saves. */}}};}
const api={create,tunes};if(typeof module!=='undefined')module.exports=api;else root.ZachSound=api;
})(globalThis);
