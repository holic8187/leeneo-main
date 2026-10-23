'use strict';
const path=require('node:path');
const manifest=require('./data/cardArtManifest.json');
const artRoot=path.resolve(__dirname,'../../tcg-desktop/public/assets');

function registerCardArtRoutes({app}){
  app.get('/api/tcg/art/:filename',(req,res)=>{
    const match=/^([a-z][a-z-]+)\.(webp|png)$/.exec(String(req.params.filename||''));
    const art=match&&manifest[match[1]];
    const requestedRevision=req.query.v;
    if(!art||(requestedRevision!==undefined&&(typeof requestedRevision!=='string'||!/^[a-f0-9]{64}$/.test(requestedRevision))))return res.status(404).end();
    const exactRevision=requestedRevision===art.sha256&&path.basename(art.path)===req.params.filename;
    // Public artwork only; no account data, paths or HTML are served here.
    res.set('Access-Control-Allow-Origin','*');
    res.set('Access-Control-Expose-Headers','X-Card-Art-Revision, X-Card-Art-SHA256, X-Card-Art-Bytes');
    res.set('X-Card-Art-Revision',art.sha256);
    res.set('X-Card-Art-SHA256',art.sha256);
    res.set('X-Card-Art-Bytes',String(art.bytes));
    res.set('Cross-Origin-Resource-Policy','cross-origin');
    res.set('X-Content-Type-Options','nosniff');
    // Older apps may still request the previous filename/hash. Announce the
    // current original so they can verify it, without making that URL immutable.
    if(requestedRevision&&!exactRevision)res.set('Cache-Control','no-cache');
    res.type(path.extname(art.path)==='.png'?'image/png':'image/webp');
    res.sendFile(art.path,{root:artRoot,maxAge:exactRevision?'365d':'5m',immutable:exactRevision,dotfiles:'deny'},error=>{
      if(error&&!res.headersSent)res.status(error.statusCode===404?404:500).end();
    });
  });
}
module.exports={registerCardArtRoutes};
