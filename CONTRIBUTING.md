# Contributing

Make a tiny human, fix a bug, add a hairstyle—small contributions are welcome.

1. Fork the repository and make a focused branch.
2. Use Node.js 22+. Run `npm run dev` and `npm test`; no npm install is needed.
3. Keep the board UI monochrome, portrait 240×320, and free of scrolling. Keep all five care buttons usable. Preserve the original compact Classic sprite.
4. Edit shared artwork/sound in `dist/avatar.js` / `dist/sound.js`, then run `node scripts/build-avatar.cjs`. Commit the generated headers along with the source change.
5. Keep JS and firmware care rules in sync. Don't write flash every animation/frame. Keep touch and care responsive during audio playback.
6. Test save compatibility and interrupted-write recovery for persistence changes. Never silently turn a clean install into a destructive "update" or bypass board/flash checks.
7. Describe what you tested and what needs physical hardware. Browser screenshots are useful, but aren't proof of a hardware test.

Firmware setup/build instructions are in [firmware/README.md](firmware/README.md). Release packaging is documented in [docs/RELEASING.md](docs/RELEASING.md). Native Windows script tests run with `pwsh -NoProfile -File tests/windows-flasher.test.ps1`; set `ZACH_PWSH` to run them as part of `npm test` on another host.

Please preserve third-party notices. Contribute only code/art/sounds you can license under this project's MIT license (or clearly identify a compatible, separately licensed dependency). Do not submit paid/private case files. Contributions are under the same license unless agreed otherwise.

When reporting a bug, include the board's printed model, firmware version, computer OS, and steps to reproduce. Redact Wi-Fi passwords, SSIDs, personal paths, and other private details from logs. Never share a full flash dump publicly.
