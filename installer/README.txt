ZACHAGOTCHI MAC FLASHER — 0.3.0 (PUBLIC PREVIEW)
Freenove FNK0104B, 2.8-inch ILI9341 capacitive touch, ESP32-S3 N16R8

This package includes the compiled Zachagotchi firmware. It has been compiled
and checked. The original game ran on the user’s board; the hat, coffee, creator
and audio updates still need physical-board testing. FNK0104A is the
non-touch model; it is not supported by this touch-button game.

INSTALL
1. Open Zachagotchi Flasher.app (or Zachagotchi Flasher.command).
   A Terminal window opens.
2. Connect the board with a USB data cable. Close other serial tools.
3. Select the board's USB serial port.
4. Check the board model. Type INSTALL to erase and install Zachagotchi.
5. The installer checks the ESP32-S3 and 16 MB flash size, then erases all flash
   and writes the new firmware. No backup is made.
6. Leave USB connected until flashing and verification finish. The board resets.
   If the screen stays black, tap RESET/RST once without holding BOOT.

WARNING: This is a clean-install tool, not a save-preserving updater.
It deletes the current program, Wi-Fi settings and ALL saved progress, including
existing Zachagotchi progress. There is no undo or restore option. Nothing is
erased until you type INSTALL. Normal power loss does not erase saved progress;
running this clean installer again does.

FIRST START / CLOCK
The board initially shows Wi-Fi setup. On your phone or Mac, join the
Zachagotchi-XXXX network using the password shown on the board. Open
http://192.168.4.1 and enter your 2.4 GHz Wi-Fi name, password and time zone.
Credentials are saved on the board only. Wi-Fi turns off after clock sync.
To change these later, hold the character name at the top left for three seconds.
You can tap SKIP FOR NOW and play offline. The clock shows --:-- until synced.
After complete power loss, saved progress returns; elapsed offline time is
reconciled when the clock next syncs. No battery-backed clock is assumed.

CUSTOMIZE
Tap the name at the top left to open the creator. LOOK changes hair and facial
hair (Classic head size). OUTFIT changes shirt, pants and SOUND ON/OFF. Tap the name
inside the creator to use the on-screen keyboard (up to 12 letters). SAVE keeps
changes; CANCEL discards them. Everything fits the 240x320 display.
Appearance and mute are saved independently of care progress. No reflash is
needed to customize. The original bald, bearded Zach remains the default.

SOUND
Short original retro effects play for feeding, love, play, sleep/wake and saving.
A speaker must be connected to the board’s speaker socket. No SD card, audio
files, internet or microphone input is needed. Sound failure does not stop the
game. Turn SOUND OFF in OUTFIT for quiet play.

PLAY
Feed, Love, Play, Sleep and Coffee are touch buttons. Tapping the top of Zach's
head toggles his hat; tapping his body gives head pats.
Sleep is Zach's nap. The display separately turns off after one minute idle;
double-tap to wake it, or tap the clock to turn it off immediately.
Progress saves after care actions, before screen-off, and every five minutes,
using alternating checked snapshots. A cut during a save can lose the action
being written; the previous valid save remains recoverable.

The top-right battery icon and percentage are estimated from battery voltage.
This is not a precision fuel gauge. USB/charging voltage can affect the estimate,
and this board does not provide a confirmed battery-presence/charging signal.
Unknown or invalid readings show --%. No hours-remaining prediction is made.

MAC / TROUBLESHOOTING
Both Intel and Apple Silicon flashing tools are included. No Python, Homebrew,
Arduino, Rosetta or internet connection is needed to run this installer. Wi-Fi is only
used by the board to set its clock.
This personal build is not Developer ID signed or notarized; macOS may ask for
approval to open it. It installs no drivers, system services or login items.
If connection fails: keep USB connected, hold BOOT, press and release RESET/RST,
then release BOOT. Reopen the installer and select the USB port again; its name
may change in flashing mode. Close other serial tools; try another data-capable
cable if needed. If the initial connection/check fails, nothing is erased.
If installation fails after erasing begins, the old program may already be gone;
retry installation using BOOT/RESET. Do not unplug during flashing.
After a cancelled or failed session, tap RESET if the old app doesn't restart.

Only a temporary diagnostic log is created on the Mac; no board backup is read
or saved. The clean install erases flash, not hardware eFuses or security keys.

OPEN SOURCE / UPDATES
Original Zachagotchi code is MIT licensed (LICENSE.Zachagotchi). Third-party
licenses remain separate; see THIRD-PARTY.txt and licenses/. Complete project
source is in the matching release source ZIP/tag. No external case files are
distributed. Download a newer installer to update; updates currently erase saves.
