Build output for the Freenove FNK0104B touch board.

Run npm run build:firmware to generate bootloader.bin, partitions.bin,
zachagotchi.bin, board.txt and manifest.tsv from firmware/Zachagotchi.
Do not substitute another project's firmware or rename browser files to .bin.

The release builder validates ESP32-S3 headers, partition layout, file bounds
and hashes before packaging. NVS stays at 0x9000–0xdfff. The factory app starts
at 0x10000. No merged image or boot_app0 padding is flashed. The clean installer
erases the entire flash first, including NVS; existing saves are not retained.
