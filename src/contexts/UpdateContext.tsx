import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import {
  checkForUpdate,
  type UpdateInfo,
  type UpdateHandle,
  type UpdaterPhase,
  relaunchApp,
} from "../lib/updater";
import { getPlatform } from "../lib/platform";

type UpdateProgress = {
  total: number;
  downloaded: number;
  percent: number;
};

interface UpdateContextValue {
  hasUpdate: boolean;
  updateInfo: UpdateInfo | null;
  updateHandle: UpdateHandle | null;
  isChecking: boolean;
  error: string | null;
  updatePhase: UpdaterPhase;
  updateProgress: UpdateProgress | null;
  isDismissed: boolean;
  dismissUpdate: () => void;
  checkUpdate: () => Promise<boolean>;
  installUpdate: () => Promise<boolean>;
  resetDismiss: () => void;
}

const UpdateContext = createContext<UpdateContextValue | undefined>(undefined);

const DISMISSED_KEY_PREFIX = "agent-skills-guard:update:dismissedVersion";

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateHandle, setUpdateHandle] = useState<UpdateHandle | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatePhase, setUpdatePhase] = useState<UpdaterPhase>("idle");
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const isCheckingRef = useRef(false);
  const updatePhaseRef = useRef<UpdaterPhase>("idle");

  const setUpdatePhaseSafe = useCallback((phase: UpdaterPhase) => {
    updatePhaseRef.current = phase;
    setUpdatePhase(phase);
  }, []);

  const checkUpdate = useCallback(async (): Promise<boolean> => {
    if (isCheckingRef.current) return false;
    if (
      updatePhaseRef.current === "downloading" ||
      updatePhaseRef.current === "installing" ||
      updatePhaseRef.current === "restartRequired" ||
      updatePhaseRef.current === "restarting"
    ) {
      return false;
    }

    isCheckingRef.current = true;
    setIsChecking(true);
    setError(null);

    try {
      const result = await checkForUpdate({ timeout: 30000 });

      if (result.status === "available") {
        setHasUpdate(true);
        setUpdateInfo(result.info);
        setUpdateHandle(result.update);

        const dismissedVersion = localStorage.getItem(DISMISSED_KEY_PREFIX);
        setIsDismissed(dismissedVersion === result.info.availableVersion);

        return true;
      } else {
        setHasUpdate(false);
        setUpdateInfo(null);
        setUpdateHandle(null);
        setIsDismissed(false);
        setUpdatePhaseSafe("idle");
        setUpdateProgress(null);
        return false;
      }
    } catch (err) {
      console.error("[UpdateContext] Check update failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setHasUpdate(false);
      return false;
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem(DISMISSED_KEY_PREFIX, updateInfo.availableVersion);
      setIsDismissed(true);
    }
  }, [updateInfo]);

  const installUpdate = useCallback(async (): Promise<boolean> => {
    if (
      !updateHandle ||
      updatePhase === "downloading" ||
      updatePhase === "installing" ||
      updatePhase === "restartRequired" ||
      updatePhase === "restarting"
    ) {
      return false;
    }

    setError(null);
    setUpdatePhaseSafe("downloading");
    setUpdateProgress({ total: 0, downloaded: 0, percent: 0 });

    try {
      await updateHandle.downloadAndInstall((progress) => {
        if (progress.event === "Started") {
          const total = progress.total ?? 0;
          setUpdateProgress({ total, downloaded: 0, percent: 0 });
          setUpdatePhaseSafe("downloading");
          return;
        }

        if (progress.event === "Progress") {
          setUpdateProgress((prev) => {
            const total = progress.total ?? prev?.total ?? 0;
            const downloaded = progress.downloaded ?? prev?.downloaded ?? 0;
            const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
            return { total, downloaded, percent };
          });
          return;
        }

        if (progress.event === "Finished") {
          setUpdatePhaseSafe("installing");
        }
      });

      setHasUpdate(false);
      setUpdateInfo(null);
      setUpdateHandle(null);
      setIsDismissed(false);
      setUpdateProgress(null);

      const platform = await getPlatform();
      if (platform === "windows") {
        setUpdatePhaseSafe("restartRequired");
        return true;
      }

      setUpdatePhaseSafe("restarting");
      await relaunchApp();
      return true;
    } catch (err) {
      console.error("[UpdateContext] Install update failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setUpdateProgress(null);
      setUpdatePhaseSafe("idle");
      return false;
    }
  }, [updateHandle, updatePhase]);

  const resetDismiss = useCallback(() => {
    localStorage.removeItem(DISMISSED_KEY_PREFIX);
    setIsDismissed(false);
  }, []);

  // 应用启动时自动检查（延迟1秒避免阻塞）
  useEffect(() => {
    const timer = setTimeout(() => {
      checkUpdate().catch(console.error);
    }, 1000);

    return () => clearTimeout(timer);
  }, [checkUpdate]);

  const value: UpdateContextValue = {
    hasUpdate,
    updateInfo,
    updateHandle,
    isChecking,
    error,
    updatePhase,
    updateProgress,
    isDismissed,
    dismissUpdate,
    checkUpdate,
    installUpdate,
    resetDismiss,
  };

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate() {
  const context = useContext(UpdateContext);
  if (context === undefined) {
    throw new Error("useUpdate must be used within UpdateProvider");
  }
  return context;
}
