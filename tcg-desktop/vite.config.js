import { fileURLToPath, URL } from 'node:url';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { buildCardArtManifest } from './scripts/build-card-art-manifest.mjs';

const packageMetadata = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'));

export default defineConfig(({mode,command})=>{
const environment=loadEnv(mode,process.cwd(),'VITE_');
const configuredBase=String(process.env.VITE_TCG_API_BASE || environment.VITE_TCG_API_BASE || '').replace(/\/+$/,'');
const useRemote=process.env.TCG_REMOTE_CARD_ART==='1'||(command==='build'&&process.env.TCG_REMOTE_CARD_ART!=='0'&&configuredBase.startsWith('https://'));
const remoteArtBase=useRemote?configuredBase:'';
if(remoteArtBase){const parsed=new URL(remoteArtBase);if(parsed.protocol!=='https:'||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw new Error('Card art requires an HTTPS API origin.');}
const artManifest=buildCardArtManifest({strict:command==='build'});
return {
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version),
    __REMOTE_CARD_ART_BASE__:JSON.stringify(remoteArtBase),
  },
  plugins:remoteArtBase?[{name:'remote-card-art',closeBundle(){
    // Delete exact validated build copies only. Originals stay in the server
    // repository and are never compressed, resized or deleted by this build.
    for(const art of Object.values(artManifest)){
      if(!/^(cards|bosses|relics)\/[a-z][a-z-]+\.(webp|png)$/.test(art.path))throw new Error('Invalid card art path');
      const asset=fileURLToPath(new URL(`./dist/assets/${art.path}`,import.meta.url));
      if(existsSync(asset))unlinkSync(asset);
    }
  }}]:[],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/android/**', '**/ios/**'],
    },
  },
};});
