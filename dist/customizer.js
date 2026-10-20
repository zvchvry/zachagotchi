'use strict';
const avatarStore=ZachAvatar.createStore(()=>localStorage);
let profile=avatarStore.load();
const sound=ZachSound.create();
let editing=false,draft=null,editorPage=0;
const editor=document.getElementById('customizer');
const editorBody=document.getElementById('editor-body');
function openEditor(){if(displayAsleep)return;draft={...profile};editing=true;editorPage=0;editor.hidden=false;ui['game-content'].inert=true;resetIdle();drawEditor();}
function closeEditor(){sound.stop();editing=false;editor.hidden=true;ui['game-content'].inert=false;drawnSleeping=undefined;render();resetIdle();document.getElementById('edit-avatar').focus();}
function editorButton(label,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls;b.addEventListener('click',()=>{resetIdle();fn();});return b;}
function drawEditor(){
 editorBody.replaceChildren();
 const name=document.createElement('div');name.className='editor-name';name.textContent=draft.name||'your name';
 if(editorPage===2){
   editorBody.append(name);
   const hint=document.createElement('p');hint.className='name-hint';hint.textContent='12 letters · tap to type';editorBody.append(hint);
   const keys=document.createElement('div');keys.className='name-keys';
   for(const char of "abcdefghijklmnopqrstuvwxyz'- ".split('').concat(['DEL']))keys.append(editorButton(char===' '?'SPACE':char==='DEL'?'DEL':char.toUpperCase(),()=>{if(char==='DEL')draft.name=draft.name.slice(0,-1);else if(draft.name.length<12)draft.name+=char;drawEditor();}));
   editorBody.append(keys);
   editorBody.append(editorButton('BACK TO LOOK',()=>{editorPage=0;drawEditor();},'name-back'));
 } else {
   const canvas=document.createElement('canvas');canvas.width=canvas.height=32;canvas.className='editor-avatar';ZachAvatar.draw(canvas.getContext('2d'),draft,false,ink,paper);editorBody.append(canvas);
   editorBody.append(editorButton('tiny '+(draft.name||'your name')+'  [EDIT]',()=>{editorPage=2;drawEditor();},'name-edit'));
   const tabs=document.createElement('div');tabs.className='editor-tabs';['LOOK','OUTFIT'].forEach((label,i)=>{const b=editorButton(label,()=>{editorPage=i;drawEditor();});b.setAttribute('aria-pressed',String(editorPage===i));tabs.append(b);});editorBody.append(tabs);
   for(const key of editorPage===0?['hair','beard']:['shirt','pants','sound']){
     const row=document.createElement('div');row.className='editor-row';
     const index=(editorPage===0?['hair','beard']:['shirt','pants','sound']).indexOf(key);
     row.style.top=(158+index*(editorPage===0?42:28))+'px';row.style.height=(editorPage===0?40:26)+'px';
     const step=delta=>{if(key==='sound'){draft.sound=!draft.sound;sound.stop();if(draft.sound)sound.play('tap');}else{const n=ZachAvatar.options[key].length;draft[key]=(draft[key]+delta+n)%n;sound.play('tap',draft.sound);}drawEditor();};
     const left=editorButton('<',()=>step(-1));left.setAttribute('aria-label','Previous '+key);
     const value=document.createElement('span');value.textContent=(key==='beard'?'FACE':key.toUpperCase())+': '+(key==='sound'?(draft.sound?'ON':'OFF'):ZachAvatar.options[key][draft[key]]);
     const right=editorButton('>',()=>step(1));right.setAttribute('aria-label','Next '+key);row.append(left,value,right);editorBody.append(row);
   }
 }
 document.getElementById('editor-status').textContent='';
}
document.getElementById('edit-avatar').addEventListener('click',openEditor);
document.getElementById('editor-cancel').addEventListener('click',closeEditor);
document.getElementById('editor-save').addEventListener('click',()=>{
 const candidate={...draft,name:draft.name.trim()};
 if(!ZachAvatar.valid(candidate)){document.getElementById('editor-status').textContent='Please add a name (1–12 letters).';return;}
 if(!avatarStore.save(candidate)){document.getElementById('editor-status').textContent='Could not save. Please try again.';return;}
 profile=candidate;closeEditor();sound.play('save',profile.sound);
});
