(function(root){
'use strict';
const options={hair:['Bald','Crop','Side part','Curls','Long','Mohawk'],beard:['Full beard','Clean','Stubble','Mustache','Goatee'],shirt:['Dark tee','Light tee','Stripes','Overalls'],pants:['Dark','Light','Jeans','Shorts']};
const defaults={name:'zach',hair:0,beard:0,head:1,shirt:0,pants:0,hat:false,sound:true};
function valid(p){return p && typeof p.name==='string' && /^[a-zA-Z0-9 '-]{1,12}$/.test(p.name) && p.name.trim()===p.name && Object.entries(options).every(([k,v])=>Number.isInteger(p[k])&&p[k]>=0&&p[k]<v.length) && (p.hat===undefined||typeof p.hat==='boolean') && typeof p.sound==='boolean';}
function normalize(p){return {...p,head:1,hat:p.hat===true};}
function headPixels(p,sleeping=false){
 const a=new Uint8Array(1024); // One fixed Classic head; old size settings are ignored.
 const r=(x,y,w,h,c=1)=>{const left=x,right=x+w,top=y,bottom=y+h;for(let py=Math.max(0,top);py<Math.min(20,bottom);py++)for(let px=Math.max(0,left);px<Math.min(32,right);px++)a[py*32+px]=c;};
 if(p.hair===4){r(7,5,19,15);r(9,3,15,4);}
 r(12,3,9,1);r(10,4,13,2);r(9,6,15,10);r(8,9,17,5);r(10,14,13,3);r(12,17,9,2);
 r(12,4,9,1,0);r(11,5,11,1,0);r(10,6,13,10,0);r(12,16,9,2,0);r(9,10,1,3,0);r(23,10,1,3,0);
 if(p.beard===0){r(10,13,13,4);r(12,17,9,2);r(14,13,5,1,0);r(15,15,3,1,0);}
 else {r(15,15,3,1);if(p.beard===2){for(let y=13;y<18;y+=2)for(let x=11;x<22;x+=2)r(x,y,1,1);r(14,14,5,2,0);r(15,15,3,1);}if(p.beard===3||p.beard===4){r(12,13,9,1);r(11,14,4,1);r(18,14,4,1);}if(p.beard===4)r(14,17,5,2);}
 if(p.hair===1){r(11,3,11,2);r(10,5,13,1);}
 if(p.hair===2){r(10,3,13,3);r(10,6,5,2);r(20,6,3,1);r(17,3,1,2,0);}
 if(p.hair===3){for(let x=9;x<24;x+=3){r(x,3,3,3);r(x+1,2,2,1);}r(9,6,3,2);r(21,6,3,2);}
 if(p.hair===4){r(10,4,4,3);r(19,4,4,3);r(15,3,3,2,0);}
 if(p.hair===5){r(15,0,3,6);r(14,2,5,2);}
 if(sleeping){r(12,10,3,1);r(18,10,3,1);}else{r(12,9,2,2);r(19,9,2,2);}
 return a;
}
function bodyPixels(p){
 const a=new Uint8Array(1024),r=(x,y,w,h,c=1)=>{for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)a[py*32+px]=c;};
 // Original compact silhouette: 26 rows tall, connected collar, no extra shoe row.
 r(10,26,5,3);r(18,26,5,3);
 r(10,19,13,8);r(8,20,3,6);r(22,20,3,6);
 r(9,21,1,4,0);r(23,21,1,4,0);
 r(12,17,9,3);r(13,17,7,3,0);
 if(p.shirt===1)r(11,20,11,5,0);
 if(p.shirt===2){r(11,21,11,1,0);r(11,23,11,1,0);}
 if(p.shirt===3){r(11,20,11,5,0);r(12,20,2,5);r(19,20,2,5);r(13,23,7,3);}
 if(p.pants===1){r(11,26,3,2,0);r(19,26,3,2,0);}
 if(p.pants===2){r(12,27,1,1,0);r(20,27,1,1,0);}
 if(p.pants===3){r(11,27,3,1,0);r(19,27,3,1,0);}
 return a;
}
function hatPixels(p){
 const a=new Uint8Array(1024);if(p.hat!==true)return a;
 const r=(x,y,w,h)=>{for(let py=Math.max(0,y);py<Math.min(8,y+h);py++)for(let px=Math.max(0,x);px<Math.min(32,x+w);px++)a[py*32+px]=1;};
 // Rounded ball-cap crown with a short bill pointing to the right.
 // The hat stays a separate layer, preserving the original bare-headed sprite.
 r(15,0,2,1);r(12,1,8,1);r(11,2,10,1);r(10,3,12,2);
 r(9,5,19,1);r(21,6,6,1);
 return a;
}
function pixels(p,sleeping=false){const a=headPixels(p,sleeping),b=bodyPixels(p),h=hatPixels(p);return a.map((v,i)=>v|b[i]|h[i]);}
function draw(ctx,p,sleeping,ink,paper){const a=pixels(p,sleeping);ctx.clearRect(0,0,32,32);ctx.fillStyle=paper;ctx.fillRect(0,0,32,32);ctx.fillStyle=ink;for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(a[y*32+x])ctx.fillRect(x,y,1,1);}
function createStore(getStorage){let seq=0,slot=-1;const keys=['zachagotchi-avatar-a','zachagotchi-avatar-b'];return{
 load(){const found=[];for(let i=0;i<2;i++)try{const r=JSON.parse(getStorage().getItem(keys[i]));if(r?.version===1&&Number.isSafeInteger(r.sequence)&&r.sequence>0&&valid(r.profile))found.push({...r,slot:i});}catch{}found.sort((a,b)=>b.sequence-a.sequence);if(found.length){seq=found[0].sequence;slot=found[0].slot;return normalize(found[0].profile);}return {...defaults};},
 save(p){if(!valid(p))return false;const next=slot===0?1:0,r=JSON.stringify({version:1,sequence:seq+1,profile:normalize(p)});try{const s=getStorage();s.setItem(keys[next],r);if(s.getItem(keys[next])!==r)return false;seq++;slot=next;return true;}catch{return false;}}
};}
const api={options,defaults,valid,headPixels,bodyPixels,hatPixels,pixels,draw,createStore};if(typeof module!=='undefined')module.exports=api;else root.ZachAvatar=api;
})(globalThis);
