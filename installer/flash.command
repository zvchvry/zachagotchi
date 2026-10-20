#!/bin/bash
# Zachagotchi terminal flasher. Requires no Python, Homebrew or Arduino install.
set -u
set -o pipefail
umask 077
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FIRMWARE="$ROOT/firmware"
FINISHED=0

finish() {
  local status="$1"
  if [[ -t 0 && "$FINISHED" == 0 ]]; then
    FINISHED=1
    printf '\nPress Return to close… '
    read -r _ || true
  fi
  exit "$status"
}
fail() { printf '\nSTOPPED: %s\n' "$*" >&2; finish 1; }
sha256() { /usr/bin/shasum -a 256 "$1" | /usr/bin/awk '{print $1}'; }
filesize() { /usr/bin/stat -f%z "$1"; }

select_tool() {
  local architecture
  architecture="$(/usr/bin/uname -m)"
  # Prefer the hardware architecture even if Terminal was launched translated.
  if [[ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null)" == 1 ]]; then
    architecture=arm64
  fi
  case "$architecture" in
    arm64) TOOL="$ROOT/esptool-arm64" ;;
    x86_64) TOOL="$ROOT/esptool-amd64" ;;
    *) fail 'This installer supports Apple Silicon and Intel Macs.' ;;
  esac
  [[ -x "$TOOL" ]] || fail 'The bundled flashing tool is missing. Download a complete installer.'
}

validate_firmware() {
  [[ -f "$FIRMWARE/manifest.tsv" && -f "$FIRMWARE/board.txt" ]] || {
    printf '%s\n' 'Zachagotchi firmware is not bundled in this preview.' 'Installation is unavailable until the board-specific firmware is built.' >&2
    return 1
  }
  BOARD="$(cat "$FIRMWARE/board.txt")"
  [[ "$BOARD" == 'FNK0104B' ]] || { printf '%s\n' 'Unsupported board profile.' >&2; return 1; }
  FLASH_ARGS=()
  local offset filename expected size extra actual bytes limit wanted count=0
  while IFS=$'\t' read -r offset filename expected size extra || [[ -n "$offset" ]]; do
    [[ -z "$extra" && "$expected" =~ ^[0-9a-f]{64}$ && "$size" =~ ^[1-9][0-9]{0,7}$ ]] || return 1
    case "$count:$offset:$filename" in
      0:0x0:bootloader.bin) limit=32768; wanted=e9 ;;
      1:0x8000:partitions.bin) limit=4096; wanted=aa ;;
      2:0x10000:zachagotchi.bin) limit=16711680; wanted=e9 ;;
      *) return 1 ;;
    esac
    [[ -f "$FIRMWARE/$filename" && ! -L "$FIRMWARE/$filename" ]] || return 1
    bytes="$(filesize "$FIRMWARE/$filename")" || return 1
    [[ "$bytes" == "$size" && "$bytes" -le "$limit" ]] || return 1
    actual="$(sha256 "$FIRMWARE/$filename")" || return 1
    [[ "$actual" == "$expected" ]] || { printf 'Checksum mismatch: %s\n' "$filename" >&2; return 1; }
    [[ "$(/usr/bin/od -An -tx1 -N1 "$FIRMWARE/$filename" | /usr/bin/tr -d '[:space:]')" == "$wanted" ]] || return 1
    FLASH_ARGS+=("$offset" "$FIRMWARE/$filename")
    count=$((count+1))
  done < "$FIRMWARE/manifest.tsv"
  [[ "$count" == 3 ]]
}

choose_port() {
  local p answer i
  while true; do
    PORTS=()
    for p in /dev/cu.*; do
      [[ -e "$p" ]] || continue
      case "$p" in *Bluetooth*|*debug*|*wlan*) continue ;; esac
      PORTS+=("$p")
    done
    printf '\nUSB serial ports:\n'
    for ((i=0; i<${#PORTS[@]}; i++)); do printf '  %d) %s\n' "$((i+1))" "${PORTS[$i]}"; done
    if [[ "${#PORTS[@]}" == 0 ]]; then printf '  None found. Connect a USB data cable and close any serial monitor.\n'; fi
    printf 'Choose a number, r to scan again, or q to quit: '
    read -r answer || finish 0
    case "$answer" in q|Q) finish 0 ;; r|R|'') continue ;; esac
    if [[ "$answer" =~ ^[1-9][0-9]?$ ]] && ((answer <= ${#PORTS[@]})); then
      PORT="${PORTS[$((answer-1))]}"; return
    fi
    printf 'Please choose one of the listed ports.\n'
  done
}

run_tool() {
  "$TOOL" --chip esp32s3 --port "$PORT" --baud 460800 --after "${AFTER_RESET:-no-reset}" "$@" 2>&1 | /usr/bin/tee -a "$LOG"
}

check_board() {
  printf '\nChecking chip and flash size…\n'
  run_tool flash-id || fail 'No connection to the ESP32-S3. No firmware was written.
Keep USB connected. Hold BOOT, press and release RESET/RST, then release BOOT.
Close other serial tools. Reopen this installer and select the USB port again;
its name may change in flashing mode. If needed, try another USB data cable.'
  # esptool is pinned; reject missing/unknown size before allowing any erase.
  /usr/bin/grep -Eq '^Detected flash size: 16[[:space:]]*MB[[:space:]]*$' "$LOG" || fail 'This board does not report the expected 16 MB flash. Nothing was erased or written.'
}

# --check validates bundled firmware without connecting to any board.
if [[ "${1:-}" == '--tool-version' && $# == 1 ]]; then
  select_tool
  printf 'Native flashing tool: %s\n' "${TOOL##*/}"
  exec "$TOOL" version
fi
if [[ "${1:-}" == '--check' && $# == 1 ]]; then
  validate_firmware || exit 2
  printf 'Firmware manifest, sizes, headers and SHA-256 checks passed.\n'
  exit 0
fi
[[ $# == 0 ]] || fail 'Unknown option.'
select_tool
printf '\nZACHAGOTCHI — Mac firmware flasher\n=================================\n'
validate_firmware || fail 'No valid Zachagotchi firmware is available. Nothing on the board was changed.'
choose_port
printf '\nSelected: %s\n' "$PORT"
printf '\nCLEAN INSTALL — Zachagotchi for %s\n' "$BOARD"
printf 'Check that this model is printed on your board. Keep USB connected.\n'
printf 'This erases ALL flash: the current program, Wi-Fi settings and saved progress.\n'
printf 'No backup will be made. This cannot be undone by this installer.\n'
printf 'Type INSTALL to erase and install Zachagotchi, or press Return to cancel: '
read -r confirm || finish 0
[[ "$confirm" == INSTALL ]] || { printf 'Cancelled. Nothing on the board was changed.\n'; finish 0; }
LOG="$(/usr/bin/mktemp "${TMPDIR:-/tmp/}zachagotchi-install.XXXXXX")" || fail 'Could not create the installation log. Nothing was changed.'
printf '\nInstallation log: %s\n' "$LOG"
check_board
# Revalidate after the prompt and hardware check, immediately before erasing.
validate_firmware || fail 'The firmware changed or failed validation. Nothing was written.'
printf '\nErasing all flash and installing Zachagotchi…\n'
run_tool write-flash --erase-all "${FLASH_ARGS[@]}" || fail 'Installation failed. The old program may already be erased. Keep USB connected and retry using BOOT/RESET.'
AFTER_RESET=watchdog-reset run_tool verify-flash "${FLASH_ARGS[@]}" || fail 'Verification failed. Installation is not complete; retry using BOOT/RESET.'
printf '\nZachagotchi installed and verified. The board should restart.\n'
printf 'If the screen stays black, tap RESET/RST once without holding BOOT.\n'
finish 0
