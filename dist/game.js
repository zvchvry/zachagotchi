(function(root){
const initial=()=>({food:80,love:90,energy:75,sleeping:false,born:Date.now(),updated:Date.now(),plays:0});
function advance(s,now){const hours=Math.max(0,(now-s.updated)/3600000);return {...s,food:Math.max(15,s.food-hours*3),love:Math.max(20,s.love-hours*2),energy:Math.max(15,Math.min(100,s.energy+hours*(s.sleeping?18:-2))),updated:Math.max(now,s.updated)};}
function act(s,action){s=advance(s,Date.now());if(action==='sleep')return {...s,sleeping:!s.sleeping};if(s.sleeping)return s;if(action==='feed')s.food=Math.min(100,s.food+20);if(action==='love')s.love=Math.min(100,s.love+15);if(action==='play'){s.love=Math.min(100,s.love+10);s.energy=Math.max(15,s.energy-8);s.plays++;}if(action==='coffee')s.energy=Math.min(100,s.energy+20);return s;}
const api={initial,advance,act};if(typeof module!=='undefined')module.exports=api;else root.ZachGame=api;
})(globalThis);
