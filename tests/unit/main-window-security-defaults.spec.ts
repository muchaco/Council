import { describe, expect, it } from "vitest";
import { buildMainWindowOptions } from "../../src/main/windows/main-window-options";

describe("main window security defaults", () => {
  it("enforces required electron security settings", () => {
    const options = buildMainWindowOptions();

    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.webSecurity).toBe(true);
  });
});
