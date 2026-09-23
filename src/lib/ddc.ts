import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Cache, getPreferenceValues } from "@vicinae/api";

const execFileAsync = promisify(execFile);
const cache = new Cache();
const MONITORS_KEY = "monitors";
const BRIGHTNESS_VCP = "10";

export interface Monitor {
  bus: number;
  connector: string;
  name: string;
}

export interface MonitorBrightness extends Monitor {
  /** Brightness as a percentage of the monitor's maximum, 0-100. */
  percent: number;
  max: number;
}

function ddcutilBin(): string {
  const { ddcutilPath } = getPreferenceValues<Preferences>();
  return ddcutilPath?.trim() || "ddcutil";
}

export function stepSize(): number {
  const { step } = getPreferenceValues<Preferences>();
  return Number(step) || 10;
}

async function ddcutil(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(ddcutilBin(), args, { timeout: 15000 });
  return stdout;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Parses `ddcutil detect --terse`, skipping displays that don't support DDC/CI. */
export function parseDetect(output: string): Monitor[] {
  const monitors: Monitor[] = [];
  for (const block of output.split(/\n(?=\S)/)) {
    if (!block.startsWith("Display ")) continue;
    const bus = block.match(/I2C bus:\s*\/dev\/i2c-(\d+)/)?.[1];
    if (!bus) continue;
    const connector = block.match(/DRM[_ ]connector:\s*(\S+)/)?.[1] ?? "";
    // "Monitor: MFG:MODEL:SERIAL"
    const [, model] = (block.match(/Monitor:\s*(.*)/)?.[1] ?? "").split(":");
    monitors.push({
      bus: Number(bus),
      connector: connector.replace(/^card\d+-/, ""),
      name: model?.trim() || `Display on i2c-${bus}`,
    });
  }
  return monitors;
}

export async function detectMonitors(): Promise<Monitor[]> {
  const monitors = parseDetect(await ddcutil(["detect", "--terse"]));
  cache.set(MONITORS_KEY, JSON.stringify(monitors));
  return monitors;
}

/** Returns cached monitors, detecting them on first use. */
export async function getMonitors(): Promise<Monitor[]> {
  const cached = cache.get(MONITORS_KEY);
  if (cached) {
    try {
      const monitors = JSON.parse(cached) as Monitor[];
      if (monitors.length > 0) return monitors;
    } catch {
      // fall through to detection
    }
  }
  return detectMonitors();
}

export async function getBrightness(monitor: Monitor): Promise<MonitorBrightness> {
  const out = await ddcutil(["--bus", String(monitor.bus), "getvcp", BRIGHTNESS_VCP, "--brief"]);
  // "VCP 10 C <current> <max>"
  const match = out.match(/VCP\s+10\s+C\s+(\d+)\s+(\d+)/);
  if (!match) throw new Error(`Unexpected ddcutil output for ${monitor.name}: ${out.trim()}`);
  const current = Number(match[1]);
  const max = Number(match[2]) || 100;
  return { ...monitor, max, percent: clampPercent((current / max) * 100) };
}

export async function setBrightness(monitor: Monitor, percent: number, max = 100): Promise<void> {
  const value = Math.round((clampPercent(percent) / 100) * max);
  await ddcutil(["--bus", String(monitor.bus), "--noverify", "setvcp", BRIGHTNESS_VCP, String(value)]);
}

/**
 * Runs `fn` on every monitor in parallel. If any call fails with cached monitors,
 * the monitor list is re-detected once (e.g. after replugging) and the calls are retried.
 */
async function forAllMonitors<T>(fn: (monitor: Monitor) => Promise<T>): Promise<T[]> {
  const monitors = await getMonitors();
  try {
    return await Promise.all(monitors.map(fn));
  } catch {
    const fresh = await detectMonitors();
    if (fresh.length === 0) throw new Error("No DDC/CI capable monitors found");
    return Promise.all(fresh.map(fn));
  }
}

export function getAllBrightness(): Promise<MonitorBrightness[]> {
  return forAllMonitors(getBrightness);
}

/** Changes every monitor by `delta` points relative to its own current level. Returns the new levels. */
export function adjustAllBrightness(delta: number): Promise<MonitorBrightness[]> {
  return forAllMonitors(async (monitor) => {
    const current = await getBrightness(monitor);
    const percent = clampPercent(current.percent + delta);
    await setBrightness(monitor, percent, current.max);
    return { ...current, percent };
  });
}

export function describeError(error: unknown): string {
  const err = error as NodeJS.ErrnoException & { stderr?: string };
  if (err?.code === "ENOENT") return "ddcutil not found. Install it or set its path in the extension preferences.";
  const stderr = err?.stderr?.trim();
  if (stderr) return stderr.split("\n")[0];
  return err instanceof Error ? err.message : String(error);
}

export function formatLevels(levels: MonitorBrightness[]): string {
  const unique = new Set(levels.map((l) => l.percent));
  if (unique.size === 1) return `${levels[0].percent}%`;
  return levels.map((l) => `${l.name} ${l.percent}%`).join(", ");
}
