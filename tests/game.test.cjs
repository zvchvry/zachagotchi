const {test}=require('node:test');const assert=require('node:assert/strict');const g=require('../dist/game.js');
test('feeding caps at 100',()=>assert.equal(g.act({...g.initial(),food:95},'feed').food,100));
test('sleep restores energy and toggles',()=>{const s=g.act(g.initial(),'sleep');assert.equal(s.sleeping,true);assert.equal(g.advance(s,s.updated+36000000).energy,100);assert.equal(g.act(s,'sleep').sleeping,false)});
test('away time never kills tiny Zach',()=>{const s=g.initial();const a=g.advance(s,s.updated+864000000);assert.equal(a.food,15);assert.equal(a.love,20);assert.equal(a.energy,15)});
test('sleeping prevents feeding and playing',()=>{const s={...g.initial(),sleeping:true};assert.equal(g.act(s,'play').plays,0)});
test('play adds love and uses energy',()=>{const s=g.act(g.initial(),'play');assert.equal(s.plays,1);assert.ok(s.energy<75);assert.ok(s.love>90)});
test('coffee restores energy without changing love or play count',()=>{const s=g.act({...g.initial(),energy:85},'coffee');assert.equal(s.energy,100);assert.equal(s.love,90);assert.equal(s.plays,0)});
test('clock moving backwards never reapplies elapsed decay',()=>{const s=g.initial();const future=g.advance(s,s.updated+3600000);const back=g.advance(future,s.updated);assert.equal(back.updated,future.updated);assert.equal(g.advance(back,future.updated).food,future.food)});
