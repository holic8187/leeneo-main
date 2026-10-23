'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createHash}=require('node:crypto');
const {registerCardArtRoutes}=require('../../src/tcg/registerCardArtRoutes');
const manifest=require('../../src/tcg/data/cardArtManifest.json');
const {requireDatabaseReady}=require('../../src/databaseConnection');
const {readFileSync}=require('node:fs');
const path=require('node:path');
test('public art endpoint serves exact bytes, cache revisions and legacy assets only',async t=>{
  const app=express();registerCardArtRoutes({app});const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const id of ['simsim-c','rookie-analyst','eungga-c','coop-tetra','luxury-bag']){
    const art=manifest[id];const response=await fetch(`${base}/api/tcg/art/${art.path.split('/').at(-1)}?v=${art.sha256}`);
    assert.equal(response.status,200,id);assert.equal(response.headers.get('access-control-allow-origin'),'*');
    assert.match(response.headers.get('cache-control'),/immutable/);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,art.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),art.sha256);
  }
  for(const path of ['unknown-ssr.webp','simsim-c.webp?v=bad','..%2F..%2F.env','cardCombatPower.json']){
    assert.equal((await fetch(`${base}/api/tcg/art/${path}`)).status,404,path);
  }
});

test('a stale revision or former image extension serves the current verified original without immutable caching',async t=>{
  const app=express();registerCardArtRoutes({app});const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
  const art=manifest['simsim-c'],base=`http://127.0.0.1:${server.address().port}`;
  for(const filename of ['simsim-c.webp','simsim-c.png']){
    const response=await fetch(`${base}/api/tcg/art/${filename}?v=${'0'.repeat(64)}`);
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-cache');
    assert.equal(response.headers.get('x-card-art-sha256'),art.sha256);
    assert.equal(response.headers.get('x-card-art-revision'),art.sha256);
    assert.equal(Number(response.headers.get('x-card-art-bytes')),art.bytes);
    assert.match(response.headers.get('access-control-expose-headers'),/X-Card-Art-SHA256/);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),art.sha256);
  }
});

test('public artwork survives database recovery while account routes stay unavailable',async t=>{
  const app=express();registerCardArtRoutes({app});app.use('/api/tcg',requireDatabaseReady({isReady:()=>false}));
  app.get('/api/tcg/auth/me',(req,res)=>res.json({ok:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}`,art=manifest['simsim-c'];
  assert.equal((await fetch(`${base}/api/tcg/art/simsim-c.webp?v=${art.sha256}`)).status,200);
  assert.equal((await fetch(`${base}/api/tcg/auth/me`)).status,503);
  const source=readFileSync(path.resolve(__dirname,'../../server.js'),'utf8');
  assert.ok(source.indexOf("require('./src/tcg/registerCardArtRoutes').registerCardArtRoutes({ app })")<source.indexOf("app.use('/api/tcg', requireDatabaseReady(databaseConnection))"));
});
