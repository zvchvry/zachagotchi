# Zachagotchi firmware

Target: Freenove **FNK0104B**, ILI9341 240×320 capacitive touch, ESP32-S3 with 16 MB flash / 8 MB OPI PSRAM. User product link: [Amazon B0FSQF6FKN](https://www.amazon.com/dp/B0FSQF6FKN/). The generic listing's FNK0104A text conflicts with its touch variant; this build targets the FNK0104B capacitive-touch hardware. Freenove identifies A as non-touch and B as touch. The installer asks the user to check the board before writing.

## Implemented

- Portrait two-color pixel game, bald/bearded Zach with plain dark clothes, five touch care buttons, head pats, a tap-to-toggle hat, and coffee for an energy boost.
- Same care rates and gentle minimums as the browser prototype. No death/reset mechanic.
- Alternating Preferences/NVS save records with version, sequence, checksum, validation and readback. Saved at startup, after actions, before screen-off, and every five minutes. No write on every animation or clock tick.
- Backlight off after 60 seconds; double-tap within 400 ms / 40 pixels to wake. Touch remains monitored. This is display sleep, not MCU deep sleep. The clock and needs continue.
- Battery percentage estimated from 12 ADC samples on GPIO 9, with Freenove's ×2 voltage divider. Unknown/out-of-range readings show `--%`. Voltage-based percentages require calibration to the actual cell and are affected by USB charging; no confirmed battery-presence/charging pin is used.
- Password-protected local Wi-Fi setup at first boot, or by holding the name for 3 seconds. Network credentials stay in NVS. Clock sync uses SNTP, then Wi-Fi turns off; retry after failures / periodically thereafter. US time zones and UTC are offered; Eastern is the default.
- Offline progress recovery once the clock is known. Powered elapsed time is tracked separately so it is not counted twice when SNTP arrives. When no clock is available, display `--:--` and preserve/play from saved progress.
- A 1-bit 9.6 KB framebuffer, row-wise SPI expansion, partial room redraws for animation, and no screen redraws while asleep.

## Build

Pinned versions: Arduino CLI 1.5.1; Arduino-ESP32 3.3.12; Adafruit ILI9341 1.6.4; GFX 1.12.6; BusIO 1.17.4. The compiler and libraries are installed under `.build/arduino`, not system-wide.

A working Python 3 is needed only for the build's partition-table generator. Set `ZACH_PYTHON` if `python3` is unavailable. The installer itself includes native esptool binaries and needs no Python.

```sh
npm run setup:firmware   # first build only
npm run build:firmware
npm run fetch:tools
npm run build:dmg
npm run build:windows
```

`scripts/build-firmware.cjs` compiles ordinary C++ in `Zachagotchi/main.cpp`. The `.ino` is intentionally comment-only, so Arduino prototype generation is disabled; this avoids its Intel-only ctags dependency on Apple Silicon. Compilation and linking still run normally.

`partitions.csv` reserves NVS at `0x9000` (20 KB), and a single 3 MB factory app at `0x10000`. The DMG contains separate bootloader, partition table, and app binaries. It never flashes Arduino's merged image or boot_app0 padding. The manifest builder validates that binaries fit and do not cover NVS. The clean installer deliberately erases all flash, including NVS, before writing. Reinstallation deletes existing progress and Wi-Fi settings; normal reboot and power-loss recovery still use NVS saves.

## Verification limits

Version 0.1 was installed and reported working on the user’s board after a manual RESET. Version 0.2 adds customization and audio; it compiles and passes package checks but those additions still require physical testing. First-device checks: portrait orientation and touch alignment, ILI9341 inversion/colors, battery voltage calibration, screen wake, power-cut save recovery, Wi-Fi/SNTP, and clean-install behavior. The installer creates no backup and erases all flash after confirmation; it does not alter eFuses or security keys. A power failure during a commit may lose the in-flight action; the previous completed save remains the fallback.

## Hardware sources

- [Freenove model list](https://github.com/Freenove/Freenove_ESP32_S3_Display/blob/main/README.md)
- [Official TFT setups](https://github.com/Freenove/Freenove_ESP32_S3_Display/blob/main/Libraries/FNK0104AB/TFT_eSPI_Setups_v1.3.zip): GPIO 12/11/13 SPI, CS 10, DC 46, backlight 45 active high, inversion on.
- [Touch example](https://github.com/Freenove/Freenove_ESP32_S3_Display/blob/main/Tutorial_With_Touch/Sketches/Sketch_12.1_TFT_Touch_Draw/Sketch_12.1_TFT_Touch_Draw.ino): SDA 16, SCL 15, reset 18, interrupt 17; raw portrait coordinates.
- [Battery example](https://github.com/Freenove/Freenove_ESP32_S3_Display/blob/main/Tutorial_No_Touch/Sketches/Sketch_05.1_Battery_Voltage/Sketch_05.1_Battery_Voltage.ino): ADC GPIO 9, millivolts ×2.

## Creator and audio (0.3.0)

Tap the name to edit; hold it three seconds for Wi-Fi setup. Appearance uses
its own NVS namespace, with alternating checksummed records. Care-save v1 is
unchanged. Names are 1–12 ASCII letters, spaces, apostrophes or hyphens from the
on-screen keyboard. No scrolling or phone is needed for customization.
Tap the top of Zach's head on the game screen to save his hat on or off. Tap
his body for love; COFFEE restores energy.

Audio follows [Freenove’s music wiring](https://docs.freenove.com/projects/fnk0104/en/latest/fnk0104/codes/MAIN/7_Music.html): ES8311 at I2C 0x18 on the shared touch bus; MCLK4, BCLK5, WS7, speaker DOUT8, DIN6; amp GPIO1 active low. I2S runs 16 kHz, 16-bit stereo, MCLK256. Codec I/O uses the existing Wire bus with its 20 ms timeout. The optional audio task synthesizes bounded effects through a one-item queue; touch, care and rendering do not wait on playback. The amplifier is off when idle, muted or screen-sleeping. The receive channel is configured for the board’s duplex clock setup but never read or recorded. Missing codec initialization leaves the game playable and silent.

Original effects are generated at low amplitude; actual loudness and touch/audio
coexistence need a speaker test. The browser preview cannot test physical audio.

## Public releases

See [release policy](../docs/RELEASING.md) for packaging, matching source, and
Windows validation. Windows ZIPs can be packaged on macOS from the exact same
validated firmware as the DMG. Both are explicitly destructive clean installers.
The original application source is MIT; third-party codec/core/libraries keep
their own licenses. No case files are part of this firmware.
