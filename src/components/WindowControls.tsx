import { useState, useEffect } from "react";
import { Minus, Plus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getPlatform, type Platform } from "../lib/platform";

export function WindowControls() {
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    getPlatform().then(setPlatform);
  }, []);

  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleMaximize = () => {
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  const renderMacButtons = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClose}
        className="group w-3.5 h-3.5 rounded-full bg-[#FF5F57] hover:brightness-110 transition-all flex items-center justify-center"
        aria-label="Close window"
      >
        <X
          className="w-2.5 h-2.5 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
          strokeWidth={2.5}
        />
      </button>
      <button
        onClick={handleMinimize}
        className="group w-3.5 h-3.5 rounded-full bg-[#FEBC2E] hover:brightness-110 transition-all flex items-center justify-center"
        aria-label="Minimize window"
      >
        <Minus
          className="w-2.5 h-2.5 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
          strokeWidth={2.5}
        />
      </button>
      <button
        onClick={handleMaximize}
        className="group w-3.5 h-3.5 rounded-full bg-[#28C840] hover:brightness-110 transition-all flex items-center justify-center"
        aria-label="Maximize window"
      >
        <Plus
          className="w-2.5 h-2.5 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
          strokeWidth={2.5}
        />
      </button>
    </div>
  );

  const renderWindowsButtons = () => (
    <div className="flex items-stretch" data-tauri-drag-region="false">
      <button
        onClick={handleMinimize}
        className="group w-12 h-12 flex items-center justify-center hover:bg-foreground/5 transition-colors"
        aria-label="Minimize window"
      >
        <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
      <button
        onClick={handleMaximize}
        className="group w-12 h-12 flex items-center justify-center hover:bg-foreground/5 transition-colors"
        aria-label="Maximize window"
      >
        <Square className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
      <button
        onClick={handleClose}
        className="group w-12 h-12 flex items-center justify-center hover:bg-destructive transition-colors"
        aria-label="Close window"
      >
        <X className="w-4 h-4 text-muted-foreground group-hover:text-destructive-foreground transition-colors" />
      </button>
    </div>
  );

  return (
    <>
      {platform === "macos" && renderMacButtons()}
      {platform === "windows" && renderWindowsButtons()}
      {platform === "linux" && renderWindowsButtons()}
      {platform === "unknown" && renderWindowsButtons()}
    </>
  );
}
