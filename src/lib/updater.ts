import { check, type CheckOptions as UpdaterCheckOptions } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateChannel = "stable" | "beta";

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "restartRequired"
  | "restarting"
  | "upToDate"
  | "error";

export interface UpdateInfo {
  currentVersion: string;
  availableVersion: string;
  notes?: string;
  pubDate?: string;
}

export interface UpdateProgressEvent {
  event: "Started" | "Progress" | "Finished";
  total?: number;
  downloaded?: number;
}

export interface UpdateHandle {
  version: string;
  notes?: string;
  date?: string;
  downloadAndInstall(onProgress?: (e: UpdateProgressEvent) => void): Promise<void>;
}

export async function getCurrentVersion(): Promise<string> {
  const { getVersion } = await import("@tauri-apps/api/app");
  return await getVersion();
}

export async function checkForUpdate(
  opts: UpdaterCheckOptions = {}
): Promise<
  { status: "up-to-date" } | { status: "available"; info: UpdateInfo; update: UpdateHandle }
> {
  const currentVersion = await getCurrentVersion();
  const runCheck = (options: UpdaterCheckOptions) => check({ ...options });

  let update: Awaited<ReturnType<typeof check>> = null;
  try {
    update = await runCheck(opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isMissingPlatform =
      message.includes("platform") &&
      message.includes("was not found") &&
      message.includes("platforms");

    const missingPlatform = message.match(/platform `([^`]+)`/)?.[1];

    // 兼容 macOS universal 构建：当 latest.json 使用 `darwin-universal` 作为 key 时，
    // 默认的 `darwin-{arch}` 会找不到对应平台。
    if (isMissingPlatform && missingPlatform?.startsWith("darwin-")) {
      update = await runCheck({ ...opts, target: "darwin-universal" });
    } else {
      throw err;
    }
  }

  if (!update?.available) {
    return { status: "up-to-date" };
  }

  const info: UpdateInfo = {
    currentVersion,
    availableVersion: update.version,
    notes: update.body,
    pubDate: update.date,
  };

  const updateHandle: UpdateHandle = {
    version: update.version,
    notes: update.body,
    date: update.date,
    async downloadAndInstall(onProgress) {
      let total = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        if (!onProgress) return;

        const mapped: UpdateProgressEvent = {
          event: event.event,
        };

        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          downloaded = 0;
          mapped.total = total;
          mapped.downloaded = downloaded;
        } else if (event.event === "Progress") {
          const chunkLength = event.data.chunkLength ?? 0;
          const nextDownloaded = downloaded + chunkLength;

          if (total > 0 && nextDownloaded > total) {
            downloaded = Math.min(chunkLength, total);
          } else {
            downloaded = nextDownloaded;
          }

          if (total > 0 && downloaded > total) {
            downloaded = total;
          }
          mapped.total = total;
          mapped.downloaded = downloaded;
        } else if (event.event === "Finished") {
          mapped.total = total;
          mapped.downloaded = downloaded;
        }

        onProgress(mapped);
      });
    },
  };

  return { status: "available", info, update: updateHandle };
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
