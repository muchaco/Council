import { describe, expect } from "vitest";
import {
  MAIN_WINDOW_INITIAL_CONTENT_WIDTH_PX,
  buildMainWindowOptions,
} from "../../src/main/windows/main-window-options";
import { itReq } from "../helpers/requirement-trace";

const SECURITY_REQUIREMENT_IDS = ["A2"] as const;
const SIZING_REQUIREMENT_IDS = ["U0.2"] as const;

describe("main window security defaults", () => {
  itReq(SECURITY_REQUIREMENT_IDS, "enforces required electron security settings", () => {
    const options = buildMainWindowOptions();

    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.webSecurity).toBe(true);
  });

  itReq(SIZING_REQUIREMENT_IDS, "uses a fitted initial content width for the main window", () => {
    const options = buildMainWindowOptions();

    expect(MAIN_WINDOW_INITIAL_CONTENT_WIDTH_PX).toBe(1216);
    expect(options.useContentSize).toBe(true);
    expect(options.width).toBe(MAIN_WINDOW_INITIAL_CONTENT_WIDTH_PX);
  });
});
