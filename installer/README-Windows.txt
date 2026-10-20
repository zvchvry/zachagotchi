ZACHAGOTCHI WINDOWS FLASHER - 0.3.0 (PUBLIC PREVIEW)
Freenove FNK0104B capacitive touch / ESP32-S3 / 16 MB flash
Windows 10/11 x64. Not Windows ARM64 or 32-bit Windows.

1. EXTRACT ALL files from the ZIP first. Keep the whole folder together.
2. Connect the board's USB-C upload port with a USB DATA cable.
3. Close other serial monitors / flashing tools.
4. Double-click Zachagotchi Flasher.cmd. A PowerShell terminal opens.
   Do not run as administrator. No Python or Arduino installation is needed.
5. Select the board's COM port by number; r rescans, q quits.
6. Check FNK0104B is printed on your board. Type INSTALL to confirm.
7. Keep USB connected until installed and verified. If the screen stays black,
   tap RESET/RST once WITHOUT holding BOOT.

WARNING: CLEAN INSTALL ONLY. This erases ALL flash, the current program,
Wi-Fi settings and any Zachagotchi progress. No backup. No undo. Press Enter
instead of typing INSTALL to cancel. A failed initial chip/flash check does
not erase anything; a failure during writing may leave the old program erased.

FIRST START
Join the Zachagotchi-XXXX Wi-Fi network using the password shown on the board.
Open http://192.168.4.1 and enter your 2.4 GHz Wi-Fi and time zone. Or SKIP FOR NOW.
The clock needs sync after complete power loss to know time spent unplugged.
Tap the name to customize; hold it 3 seconds to reopen Wi-Fi setup.

PLAY
FEED, LOVE, PLAY, SLEEP/WAKE and COFFEE are touchscreen buttons. Tap his body for
love; tap the top of his head for the ball cap. Tap the name to customize hair,
facial hair, shirts, pants, sound and name. No scrolling. SAVE keeps your edits.
The optional speaker uses generated sounds; no memory card/audio files needed.
The display turns off after one idle minute; double-tap to wake. Tap the clock
to turn it off immediately. A nap is separate from display sleep.
Progress saves on-board during play. Reflashing, unlike power-off, deletes it.
The battery indicator is a voltage estimate; USB charging can affect it.

TROUBLESHOOTING
No connection: keep USB connected, hold BOOT, press and release RESET/RST,
then release BOOT. Restart the installer and select the port again; it may change.
No COM port: try another data cable / USB port; check Device Manager. Only use
a board/chip manufacturer's driver if needed. This package installs no drivers.
Close other serial tools if the port is busy. Don't unplug during flashing.
A temporary diagnostic log is written to your Windows temp folder; no backup.

This unsigned portable launcher runs a local script with process-only execution
policy. It changes no system PowerShell policy and installs no background service.
Respect managed-PC restrictions. Don't disable antivirus/SmartScreen to force it
through a warning. Only use a download whose source you trust.

UPDATES
Download a newer release and repeat these steps. Updates currently erase progress.
No automatic updater. No account. Network access is only needed for clock setup/sync
on the board, not to run the downloaded flasher.

STATUS / LICENSES
The Windows script is new; a real Windows-to-board test is still required.
Original game ran on the board; newer features need a full hardware test.
Original code: MIT (LICENSE.Zachagotchi). Third-party components retain their
licenses; see THIRD-PARTY.txt, LICENSE.esptool, and licenses/. Firmware source is
in firmware-source; the complete matching project source is a separate Release
Asset and in the release tag. No case files are distributed.
