import { useCallback, useEffect, useState } from "react";
import { Action, ActionPanel, Color, Icon, List, showToast, Toast } from "@vicinae/api";
import {
  clampPercent,
  describeError,
  detectMonitors,
  getBrightness,
  getMonitors,
  setBrightness,
  stepSize,
  type Monitor,
  type MonitorBrightness,
} from "./lib/ddc";

const PRESETS = [100, 75, 50, 25, 0];

function bar(percent: number): string {
  const filled = Math.round(percent / 10);
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
}

function levelIcon(percent: number) {
  return { source: percent >= 50 ? Icon.Sun : Icon.Moon, tintColor: percent === 0 ? Color.SecondaryText : Color.Yellow };
}

/** Parses search text like "40" or "40%" into a brightness level. */
function parseLevel(text: string): number | undefined {
  const match = text.trim().match(/^(\d{1,3})\s*%?$/);
  return match ? clampPercent(Number(match[1])) : undefined;
}

export default function Command() {
  const [monitors, setMonitors] = useState<MonitorBrightness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [searchText, setSearchText] = useState("");
  const step = stepSize();

  const load = useCallback(async (rescan = false) => {
    setIsLoading(true);
    try {
      const list = rescan ? await detectMonitors() : await getMonitors();
      setMonitors(await Promise.all(list.map(getBrightness)));
      setError(undefined);
    } catch (err) {
      if (!rescan) return load(true);
      setError(describeError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Sets each target monitor to the level computed from its current brightness. */
  const apply = useCallback(
    async (targets: MonitorBrightness[], level: (current: number) => number) => {
      const updates = new Map(targets.map((m) => [m.bus, level(m.percent)]));
      setMonitors((prev) => prev.map((m) => (updates.has(m.bus) ? { ...m, percent: updates.get(m.bus)! } : m)));
      try {
        await Promise.all(targets.map((m) => setBrightness(m, updates.get(m.bus)!, m.max)));
      } catch (err) {
        await showToast({ style: Toast.Style.Failure, title: "Could not set brightness", message: describeError(err) });
        load();
      }
    },
    [load],
  );

  const actions = (targets: MonitorBrightness[]) => (
    <ActionPanel>
      <ActionPanel.Section>
        <Action
          title={`Increase by ${step}%`}
          icon={Icon.Plus}
          shortcut={{ modifiers: ["ctrl"], key: "arrowUp" }}
          onAction={() => apply(targets, (p) => clampPercent(p + step))}
        />
        <Action
          title={`Decrease by ${step}%`}
          icon={Icon.Minus}
          shortcut={{ modifiers: ["ctrl"], key: "arrowDown" }}
          onAction={() => apply(targets, (p) => clampPercent(p - step))}
        />
      </ActionPanel.Section>
      <ActionPanel.Section title="Presets">
        {PRESETS.map((preset, i) => (
          <Action
            key={preset}
            title={`Set to ${preset}%`}
            icon={levelIcon(preset)}
            shortcut={{ modifiers: ["ctrl"], key: String(i + 1) as "1" }}
            onAction={() => apply(targets, () => preset)}
          />
        ))}
      </ActionPanel.Section>
      {targets.length === 1 && monitors.length > 1 && (
        <ActionPanel.Section>
          <Action
            title={`Apply ${targets[0].percent}% to All Monitors`}
            icon={Icon.Monitor}
            onAction={() => apply(monitors, () => targets[0].percent)}
          />
        </ActionPanel.Section>
      )}
      <ActionPanel.Section>
        <Action
          title="Rescan Monitors"
          icon={Icon.ArrowClockwise}
          shortcut={{ modifiers: ["ctrl"], key: "r" }}
          onAction={() => load(true)}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );

  const typedLevel = parseLevel(searchText);
  const query = searchText.trim().toLowerCase();
  const visible =
    typedLevel !== undefined || !query
      ? monitors
      : monitors.filter((m) => `${m.name} ${m.connector}`.toLowerCase().includes(query));
  const average = monitors.length
    ? Math.round(monitors.reduce((sum, m) => sum + m.percent, 0) / monitors.length)
    : 0;

  return (
    <List
      isLoading={isLoading}
      filtering={false}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Filter monitors, or type a level (e.g. 40) and press Enter"
    >
      {error && !isLoading && (
        <List.EmptyView
          icon={Icon.Warning}
          title="Could not read monitor brightness"
          description={error}
          actions={
            <ActionPanel>
              <Action title="Rescan Monitors" icon={Icon.ArrowClockwise} onAction={() => load(true)} />
            </ActionPanel>
          }
        />
      )}
      {!error && !isLoading && monitors.length === 0 && (
        <List.EmptyView
          icon={Icon.Monitor}
          title="No DDC/CI monitors found"
          description="Make sure DDC/CI is enabled in your monitor's on-screen menu. Laptop panels are not supported."
          actions={
            <ActionPanel>
              <Action title="Rescan Monitors" icon={Icon.ArrowClockwise} onAction={() => load(true)} />
            </ActionPanel>
          }
        />
      )}
      {typedLevel !== undefined && monitors.length > 0 && (
        <List.Section title="Set Level">
          <List.Item
            title={`Set all monitors to ${typedLevel}%`}
            icon={levelIcon(typedLevel)}
            accessories={[{ text: bar(typedLevel) }]}
            actions={
              <ActionPanel>
                <Action
                  title={`Set All to ${typedLevel}%`}
                  icon={Icon.Checkmark}
                  onAction={() => {
                    apply(monitors, () => typedLevel);
                    setSearchText("");
                  }}
                />
                {monitors.map((m: Monitor) => (
                  <Action
                    key={m.bus}
                    title={`Set ${m.name} to ${typedLevel}%`}
                    icon={Icon.Monitor}
                    onAction={() => {
                      apply(
                        monitors.filter((x) => x.bus === m.bus),
                        () => typedLevel,
                      );
                      setSearchText("");
                    }}
                  />
                ))}
              </ActionPanel>
            }
          />
        </List.Section>
      )}
      {monitors.length > 1 && !query && (
        <List.Section title="All Monitors">
          <List.Item
            title="All Monitors"
            subtitle={`${monitors.length} displays`}
            icon={{ source: Icon.Desktop, tintColor: Color.PrimaryText }}
            accessories={[{ text: bar(average) }, { tag: { value: `${average}%`, color: Color.Yellow } }]}
            actions={actions(monitors)}
          />
        </List.Section>
      )}
      <List.Section title="Monitors">
        {visible.map((m) => (
          <List.Item
            key={m.bus}
            title={m.name}
            subtitle={m.connector}
            icon={{ source: Icon.Monitor, tintColor: Color.PrimaryText }}
            accessories={[{ text: bar(m.percent) }, { tag: { value: `${m.percent}%`, color: Color.Yellow } }]}
            actions={actions([m])}
          />
        ))}
      </List.Section>
    </List>
  );
}
