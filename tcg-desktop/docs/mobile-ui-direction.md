# Mobile card-game UI direction (0.9.2)

## Intent

Make the cards and the next playable action the center of the mobile experience. Keep existing rules, save formats, art, and rewards. This is a layout/interaction pass, not a new game economy or an asset replacement.

- Dark charcoal navigation (`#182026`), warm paper content, restrained brass emphasis. Rarity colors belong to cards, not every control.
- Lobby: an actually owned card, adventure status/entry and raid entry first; pack opening, shared decks, and history remain accessible.
- Six labeled navigation destinations. Account, update, and donation utilities live in settings on mobile; they are not removed.
- Adventure: choose a destination, inspect requirements/rewards, edit the deck, depart. Collapse the long destination list on phones. Keep departure reachable above the bottom navigation.
- Decks: visible four-card lineup, five shared preset numbers, mutually exclusive card/equipment lists. Preserve unavailable saved cards and existing names until explicitly edited.
- Preset editing is a cancellable draft. Save/cancel stay reachable. Cloud replacement closes stale drafts.
- Use readable status labels, at least 44px primary touch targets, safe-area insets, and reduced-motion support. Missing card count and insufficient power are separate conditions.

## References and boundaries

- [Inner World original-play review, LiveREX (2013)](https://liverex.net/1811): character/card collection, party management, exploration and separate boss encounters. Also notes sluggish menu interaction; do not recreate that behavior.
- [Inner World original-play review, Game Donga (2013)](https://game.donga.com/68658/): character-centered card RPG and distinct exploration/raid loops.
- [OpenDuelyst source repository](https://github.com/open-duelyst/duelyst): collection grid alongside a deck sidebar, immediate add/remove feedback, unavailable-card states, and live deck metadata. Adapt the information relationship, not its desktop sidebar dimensions: this game uses four selected portraits and live power/card-count requirements.

These are research references, not dependencies. No third-party code, illustrations, frames, logos, or screenshots are bundled. Old Inner World image endpoints were unreliable during research; this pass does not claim a pixel-for-pixel reconstruction of its screens. All implementation and game art remain this project's own.

## Verification

Run the client tests and production build. `scripts/check-loadout-ui.mjs` runs against a local Vite server with mocked account/cloud/raid APIs, using no production account. It exercises 1440px desktop, 390px mobile, and 320px narrow-mobile layouts; captures lobby, deck editor, adventure, equipment, raid, and eligibility states; and checks shared presets and real dispatch behavior. Set `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` if Playwright is supplied by the host rather than installed locally. Start Vite with `VITE_TCG_API_BASE=https://cards.test` on port 1426.

Browser viewport checks do not substitute for physical Android testing. Release APK compilation and signing remain required before distribution.
