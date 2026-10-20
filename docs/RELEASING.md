# Releasing Zachagotchi

## First public push

The repository has no configured Git remote at preparation time. Nothing has been pushed or published by this task.

1. Review the README, MIT license, parts list, and third-party notices. The current externally sourced case is **not** part of this repository or its license.
2. Use GitHub Desktop (or a working Git installation) to commit the source folder and create/publish your GitHub repository. Pick the desired owner/repository name and **Public** visibility when ready. Don't drag the entire folder into GitHub's upload form: use Git so `.gitignore` excludes local caches, binaries, installer builds, and `.DS_Store` files. Review the file list before publishing.
3. The first public version is **v0.3.0**. Do not create tags or Releases for earlier local prototypes. Their installers have been removed from `release/`; `.build/`, board binaries, downloaded tools, and `release/` remain ignored.
4. Run the checks below. Hardware acceptance is still needed; until then use a **draft** or mark it as a **pre-release**, not a fully tested stable release.
5. On GitHub, open **Releases → Draft a new release**, create tag **v0.3.0** pointing to the exact source commit, and add the release notes from `CHANGELOG.md` (including the reset warning and known limits).
6. Upload **all four** prepared release artifacts and their `.sha256` files from `release/`:
   - `Zachagotchi-Flasher-0.3.0.dmg`
   - `Zachagotchi-Flasher-0.3.0-Windows-x64.zip`
   - `Zachagotchi-0.3.0-Source.zip`
   - `Zachagotchi-0.3.0-Third-Party-Sources.zip`
7. Keep complete matching sources and third-party notices available alongside the binary downloads. GitHub's automatically generated source ZIP does not include downloaded third-party sources.
8. Save a draft, review all Assets, and publish only when ready. A pre-release may not appear as GitHub's Latest stable release: link people to **Releases** / the specific preview until the hardware checks are complete. After validation, mark the stable release **Latest**. Don't replace published versioned binaries silently; publish a new version for changed bytes.

GitHub reference: [Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository). No GitHub Release, tag, repository visibility, or remote has been changed locally by these scripts.

## Build a release

Current firmware setup is scripted for macOS. Install Node.js 22+ and working Python 3 for development only. The downloaded installers don't need either.

```sh
npm run setup:firmware   # once, or when pinned toolchain changes
npm run fetch:tools     # official pinned Mac + Windows esptool binaries
npm test
npm run build:firmware
npm run build:dmg
npm run build:windows
npm run build:source
npm run build:third-party
npm run check:release
```

`ZACH_PYTHON=/path/to/python3 npm run build:firmware` selects a non-default Python. `ZACH_PWSH=/path/to/pwsh npm test` enables mock Windows-flasher tests on macOS/Linux. They run automatically under Windows PowerShell in Windows CI. Mac installer safety tests use fake ports/tools and only run on macOS. No test opens a real board port.

The **Build release packages** GitHub Action can do these builds after pushing. It uploads workflow artifacts for review and validates the Windows package with Windows PowerShell and the actual bundled esptool executable on a Windows runner. It does **not** publish a Release or flash hardware. Run it on the intended release commit, download its package artifact, and attach the files manually after acceptance. Workflow runs and hardware tests have not yet occurred at preparation time.

`check:release` rejects old installer archives in `release/`; it never silently deletes them. For the first public push, old local installer artifacts were explicitly removed at the author's request. Future builds create one versioned pair; remove unwanted **local** generated artifacts deliberately, not source history.

For reproducibility, the builders read the version from `package.json`, validate the exact board partition layout and firmware hashes, and use checksum-pinned flashing tools. Toolchain versions are pinned in `firmware/toolchain-lock.json`. Sources for the modified Apache-licensed codec are in the project tree. The packages are currently **unsigned/not notarized**; SHA-256 files detect corruption but are not proof of publisher identity. A future signed release should preserve these checks too.

## Verification status

At preparation of v0.3.0:

- Original game: user reported a successful install and working screen after RESET on FNK0104B.
- Browser: real screenshots captured for care controls, LOOK, OUTFIT, and name keyboard.
- Local checks on October 19, 2026: **50 automated tests passed**, including the Windows script exercised under PowerShell 7 on macOS with **32 safety assertions** and fake ports/tools. This is not a Windows OS/hardware test.
- Firmware compiled successfully (1,044,623 bytes; 49,564 bytes global RAM). Mac DMG integrity, ZIP integrity, all four artifact SHA-256 files, packaged firmware manifests, and native Mac esptool startup passed. Both installers contain the same firmware; source archives exclude build caches and private state.
- **Still required:** a real Windows-to-board install, and a full latest-firmware hardware acceptance pass on Mac/Windows. No claim of real Windows hardware testing is made.

Before marking stable, record results for:

- [ ] Native Apple Silicon Mac: no Rosetta prompt; correct port selection; erase/write/verify; reset to game.
- [ ] Intel Mac: bundled Intel tool launches and completes installation.
- [ ] Windows 10/11 x64: extract ZIP, double-click launcher, COM selection, erase/write/verify, reset to game.
- [ ] No confirmation / cancelled input / connection failure does not erase the board.
- [ ] Portrait screen, aligned touch, all five buttons, hat toggle and body-tap love.
- [ ] All creator pages fit; name/outfit/hat/mute survive reboot.
- [ ] Speaker effects, mute, no touch stalls or excessive volume.
- [ ] Power-cut save recovery; idle display sleep; double-tap wake; no accidental action on wake.
- [ ] Wi-Fi setup and time zone; complete power loss followed by clock/offline-progress recovery.
- [ ] Battery reading checked against actual cell voltage while unplugged; USB/charging limitations documented.

## How updates work

**Today:** USB-only clean reinstall. Every firmware release ships a versioned Mac DMG and Windows ZIP built from the same validated firmware. Both prominently require typing `INSTALL`, erase the entire flash, write separate bootloader/partition/app images, verify, and reset. No backup is read. Settings and progress are reset, including when upgrading Zachagotchi itself.

**Not implemented:** automatic updates, OTA, backup/restore, a save-preserving update mode, rollback, or migration from an unrelated program.

### A safe future save-preserving mode

The fixed NVS partition at `0x9000`–`0xdfff` and versioned journals are a foundation, not a promise that any future firmware is automatically compatible. Before adding UPDATE:

1. Check the installed layout and supported app/save versions, not just the chip/flash size. Refuse an unknown board, incompatible layout, or unrelated firmware.
2. Never use `--erase-all` in the update path and never write NVS/merged-image padding. Keep CLEAN INSTALL explicitly separate.
3. Preserve name/appearance/hat/mute, care progress, and network settings. Design reversible migrations and retain old valid slots until migration readback succeeds.
4. Test interrupted flash, power-cut save migration, checksum/partition mismatch, and clock catch-up using actual hardware.
5. Explain residual risk. Existing single factory-app layout has no automatic OTA rollback; not erasing NVS is not the same as guaranteed recovery.

## Keeping downloads tidy

For this first push: publish only v0.3.0. For future public releases: prefer retaining source tags and release notes and marking one release **Latest**, rather than rewriting history or breaking old download links. If necessary, remove obsolete binary Assets according to GitHub's release settings while retaining matching sources/notices and a clear explanation. Immutable releases restrict asset deletion/replacement. This project does not automatically delete remote releases or tags.

For each new version, update `package.json`, the firmware startup version, README download names, installer READMEs, and changelog. Rebuild both installers and matching source artifacts; never upload mismatched firmware under an unchanged version.
