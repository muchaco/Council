import { describe, expect } from "vitest";
import { buildMainWindowOptions } from "../../src/main/windows/main-window-options";
import { itReq } from "../helpers/requirement-trace";

const FILE_REQUIREMENT_IDS = ["A2"] as const;

describe("main window security defaults", () => {
  itReq(FILE_REQUIREMENT_IDS, "enforces required electron security settings", () => {
    const options = buildMainWindowOptions();

    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.webSecurity).toBe(true);
  });
});
