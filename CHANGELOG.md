# Changelog

## Unreleased

- Fix flaky coffee assertions by freezing the unit-test clock; retain a separate test that coffee applies real elapsed care decay.
- Fix Windows CI when npm is launched from PowerShell 7: clear the inherited module search path only in the child Windows PowerShell test process, so its built-in hashing module can load. No firmware or installer behavior change.

## 0.3.0 — first public source release (preview)

- Add project origin story, parts list, four real browser-preview screenshots, and step-by-step Mac/Windows installation instructions.
- Add portable Windows x64 terminal flasher with bundled checksum-pinned esptool; preserve explicit clean-install confirmation, chip/flash checks, payload validation, and flash verification.
- Add MIT license for original work, third-party notices, contribution guidance, and release/update policy.
- Add automated checks and release packaging workflow; keep build outputs and old installers out of source control.
- Include existing customization, ball cap toggle, body-tap love, coffee, synthesized audio, persistent saves, idle display sleep/double-tap wake, Wi-Fi clock recovery, and battery estimate.

### Known limits

- Reflashing erases saved progress and Wi-Fi settings. No backup or OTA updater.
- Original board game was user-tested; newer creator/audio/hat/coffee additions need a full board acceptance pass.
- Windows package needs a real Windows-to-board flash test. Windows ARM64/32-bit are not supported.
- Battery is voltage-estimated; complete power-loss elapsed time needs Wi-Fi clock recovery.
- No case/STL files or SD-card functionality are included.

Earlier 0.1.x–0.2.x versions were local prototypes, not public releases.
