import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, dialog, webContents } from "electron";
import type { SaveDialogOptions } from "electron";
import { ResultAsync } from "neverthrow";
import type { ExportService } from "../interfaces.js";

const sanitizeFileName = (rawTitle: string): string => {
  const normalized = rawTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const baseName = normalized.length > 0 ? normalized : "council-transcript";
  return `${baseName}.md`;
};

export const createElectronExportService = (): ExportService => ({
  saveMarkdownFile: ({ webContentsId, suggestedFileName, markdown }) =>
    ResultAsync.fromPromise(
      (async () => {
        const senderWebContents = webContents.fromId(webContentsId);
        if (senderWebContents === undefined) {
          throw new Error("ExportDialogError");
        }

        const ownerWindow = BrowserWindow.fromWebContents(senderWebContents);
        const dialogOptions: SaveDialogOptions = {
          title: "Export council transcript",
          defaultPath: sanitizeFileName(suggestedFileName),
          buttonLabel: "Export",
          filters: [
            {
              name: "Markdown",
              extensions: ["md"],
            },
          ],
          properties: ["showOverwriteConfirmation", "createDirectory"],
        };
        const dialogResult =
          ownerWindow === null
            ? await dialog.showSaveDialog(dialogOptions)
            : await dialog.showSaveDialog(ownerWindow, dialogOptions);

        if (dialogResult.canceled || dialogResult.filePath === undefined) {
          return {
            status: "cancelled" as const,
            filePath: null,
          };
        }

        await mkdir(path.dirname(dialogResult.filePath), { recursive: true });
        await writeFile(dialogResult.filePath, markdown, "utf8");
        return {
          status: "exported" as const,
          filePath: dialogResult.filePath,
        };
      })(),
      (error) => {
        if (error instanceof Error && error.message === "ExportDialogError") {
          return "ExportDialogError" as const;
        }

        return "ExportWriteError" as const;
      },
    ),
});
