# Screen Brightness for Vicinae

Control the brightness of external monitors over DDC/CI from
[Vicinae](https://vicinae.com), using [ddcutil](https://www.ddcutil.com).

## Install

```sh
git clone https://github.com/lbug/vicinae-screen-brightness
cd vicinae-screen-brightness
npm install
npm run build
```

The build installs the extension into Vicinae directly; no restart needed. See
[Requirements](#requirements) for the `ddcutil` setup.

## Commands

### Screen Brightness

Lists every detected monitor with its current level, plus an **All Monitors**
row when more than one is connected. Search filters by monitor name or
connector. Type a number instead (e.g. `40` or `40%`) and press `Enter` to set
all monitors to that level; the action panel can also apply it to a single
monitor.

| Action | Shortcut |
| --- | --- |
| Increase by one step | `Ctrl+↑` |
| Decrease by one step | `Ctrl+↓` |
| Set to 100 / 75 / 50 / 25 / 0% | `Ctrl+1` … `Ctrl+5` |
| Apply this monitor's level to all monitors | |
| Rescan Monitors | `Ctrl+R` |

### Brightness Up / Brightness Down

Change every monitor by one step relative to its own current level and show
the result as a HUD. Bind these to hotkeys in Vicinae's settings.

## Monitor detection

Monitors are detected with `ddcutil detect` the first time a command needs
them, and the result is cached so later commands don't pay the detection cost.

- **Unplugged or moved monitors are handled automatically.** If talking to a
  cached monitor fails, the extension re-detects and retries once.
- **Newly connected monitors are not picked up automatically.** As long as the
  cached monitors keep responding, nothing triggers a re-detect, so a newly
  plugged-in display stays invisible. The same applies if monitors come back on
  different I2C buses after a reboot. Run **Rescan Monitors** (`Ctrl+R` in the
  Screen Brightness view) to refresh the list.

## Requirements

- `ddcutil` installed, with the current user allowed to access `/dev/i2c-*`
  (the ddcutil package's udev rule, or membership in the `i2c` group).
- Monitors with DDC/CI enabled in their on-screen menu. Laptop panels are not
  supported; they don't speak DDC/CI.

Each change takes about a second, since DDC/CI over the display cable is slow.

## Preferences

- **Step size**: how much Brightness Up/Down and the step actions change the
  level (default 10%).
- **ddcutil binary**: path to `ddcutil` (default: `ddcutil` on `PATH`).

## Develop

```sh
npm install
npm run dev     # live-reloading development mode
npm run build   # typechecks and installs to Vicinae
npm run lint
```

`scripts/generate-icon.py` regenerates `assets/icon.png` (requires Pillow).
