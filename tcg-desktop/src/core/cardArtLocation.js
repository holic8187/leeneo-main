import { CARD_ART_MANIFEST } from '../data/cardArtManifest.js';
// Release clients use versioned public artwork. Offline developer builds and
// Node-based combat validation retain local paths without requiring a server.
export function cardArtLocation(cardId, localPath) {
  const base=typeof __REMOTE_CARD_ART_BASE__==='string'?__REMOTE_CARD_ART_BASE__:'';
  const version=typeof __APP_VERSION__==='string'?__APP_VERSION__:'dev';
  const art=CARD_ART_MANIFEST[cardId];
  const filename=art?.path.split('/').at(-1)||localPath.split('/').at(-1);
  return base ? `${base}/api/tcg/art/${encodeURIComponent(filename)}?v=${encodeURIComponent(art?.sha256 || version)}` : localPath;
}
