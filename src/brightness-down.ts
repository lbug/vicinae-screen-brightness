import { showHUD } from "@vicinae/api";
import { adjustAllBrightness, describeError, formatLevels, stepSize } from "./lib/ddc";

export default async function Command() {
  try {
    const levels = await adjustAllBrightness(-stepSize());
    await showHUD(`Brightness ${formatLevels(levels)}`);
  } catch (error) {
    await showHUD(`Brightness failed: ${describeError(error)}`);
  }
}
