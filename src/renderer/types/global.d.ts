import type { WindowApi } from "../../shared/ipc/window-api";

declare global {
  interface Window {
    api: WindowApi;
  }
}
