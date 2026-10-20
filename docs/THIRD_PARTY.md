# Third-party components and source

The root MIT license applies to **original Zachagotchi work**, not to third-party components, trademarks, or externally sourced case designs. Keep all original copyright/license notices when sharing forks or binaries.

## Firmware

| Component | Version / origin | License / source |
| --- | --- | --- |
| Arduino-ESP32 core | 3.3.12 | LGPL-2.1-or-later for the Arduino core; individual bundled components have their own notices. [Source](https://github.com/espressif/arduino-esp32/tree/3.3.12). |
| ESP-IDF | v5.5.5 as reported by the pinned ESP32-S3 build flags | Apache-2.0 with separately licensed components; use the exact SDK/tool packages selected by Arduino's pinned package index. [Source](https://github.com/espressif/esp-idf/tree/v5.5.5). |
| Adafruit ILI9341 | 1.6.4 | [Source and BSD notice](https://github.com/adafruit/Adafruit_ILI9341/tree/1.6.4). |
| Adafruit GFX | 1.12.6 | [Source and BSD notice](https://github.com/adafruit/Adafruit-GFX-Library/tree/1.12.6). |
| Adafruit BusIO | 1.17.4 | [Source and MIT notice](https://github.com/adafruit/Adafruit_BusIO/tree/1.17.4). |
| ES8311 codec driver | Apache-marked Espressif files obtained via Freenove commit `90004f874ed567b3c09d534d021172cb716e61a1` | Apache-2.0; modified source and retained notices in `firmware/Zachagotchi/src/codec`. Details in `installer/THIRD-PARTY.txt`. No Freenove demo songs/artwork are included. |

Freenove's broader tutorial repository has its own terms. This project uses its hardware documentation as a reference; the specifically Apache-marked codec files retain that explicit license. No blanket claim is made that the entire Freenove tutorial repository is MIT/Apache.

The matching project source ZIP contains the complete Zachagotchi application and modified driver. The separate third-party-source ZIP accompanies binary releases with the pinned upstream esptool/core/Adafruit source archives, license texts, dependency references, and hashes. The firmware build scripts fetch the pinned Arduino packages and provide a path to rebuild/relink with a modified core. See each upstream package for its embedded dependencies and notices; the top-level license is not a replacement for them. Keep the source ZIPs accessible with the installers when mirroring a release.

## Flashing tools

Installers redistribute unmodified official **esptool 5.6.0** executables, GPL-2.0-or-later, as separate command-line programs invoked by the original launcher scripts. Mac arm64/x86_64 and Windows x64 archives/executables are checksum-pinned in `installer/tools-lock.json`. Each package contains `LICENSE.esptool`. [Exact esptool source](https://github.com/espressif/esptool/tree/v5.6.0); its matching source archive is included in the third-party-source release asset. Upstream packaging/build files and dependency declarations are retained in that archive. The standalone executables include upstream Python/runtime dependencies; their upstream notices and source/build references must remain available too.

Arduino CLI and compilers are **development tools**, downloaded into ignored `.build/`; they are not shipped in the installers. Their licenses remain with their original packages.

## Art, audio, screenshots, and case

- Zachagotchi pixel artwork and synthesized sound sequences are original project assets under MIT.
- README screenshots are captures of this project's local browser preview, not someone else's product images.
- No official Tamagotchi graphics, sounds, firmware, logos, or case designs are included.
- Didget's Library is credited for the life-counter inspiration/current case. **No Didget case/software files are redistributed or relicensed here.** Obtain case files directly from the creator under their terms.
- Product names and shopping links identify external parts; their photos, listing text, and branding are not included as project assets.
