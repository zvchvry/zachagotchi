const {test,beforeEach}=require('node:test');const assert=require('node:assert/strict');const g=require('../dist/game.js');
// Care actions advance elapsed time first. Freeze this test file's clock so
// scheduler delays cannot add unrelated decay between initial() and act().
beforeEach(t=>{t.mock.method(Date,'now',()=>1700000000000)});
test('feeding caps at 100',()=>assert.equal(g.act({...g.initial(),food:95},'feed').food,100));
test('sleep restores energy and toggles',()=>{const s=g.act(g.initial(),'sleep');assert.equal(s.sleeping,true);assert.equal(g.advance(s,s.updated+36000000).energy,100);assert.equal(g.act(s,'sleep').sleeping,false)});
test('away time never kills tiny Zach',()=>{const s=g.initial();const a=g.advance(s,s.updated+864000000);assert.equal(a.food,15);assert.equal(a.love,20);assert.equal(a.energy,15)});
test('sleeping prevents feeding and playing',()=>{const s={...g.initial(),sleeping:true};assert.equal(g.act(s,'play').plays,0)});
test('play adds love and uses energy',()=>{const s=g.act(g.initial(),'play');assert.equal(s.plays,1);assert.ok(s.energy<75);assert.ok(s.love>90)});
test('coffee restores energy without changing love or play count',()=>{const s=g.act({...g.initial(),energy:85},'coffee');assert.equal(s.energy,100);assert.equal(s.love,90);assert.equal(s.plays,0)});
test('coffee still applies elapsed care decay before restoring energy',t=>{
  const initial={...g.initial(),energy:50,plays:3};
  const now=initial.updated+3600000;
  t.mock.method(Date,'now',()=>now);
  const advanced=g.advance(initial,now);
  const coffee=g.act(initial,'coffee');
  assert.equal(coffee.energy,advanced.energy+20);
  assert.equal(coffee.food,advanced.food);
  assert.equal(coffee.love,advanced.love);
  assert.equal(coffee.plays,initial.plays);
  assert.equal(coffee.updated,now);
});
test('clock moving backwards never reapplies elapsed decay',()=>{const s=g.initial();const future=g.advance(s,s.updated+3600000);const back=g.advance(future,s.updated);assert.equal(back.updated,future.updated);assert.equal(g.advance(back,future.updated).food,future.food)});
