import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function WindowControls() {
  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleMaximize = () => {
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  return (
    <div className="flex items-center gap-1">
      {/* Minimize Button */}
      <button
        onClick={handleMinimize}
        className="group p-2 hover:bg-terminal-cyan/10 transition-colors duration-200 rounded"
        aria-label="Minimize window"
      >
        <Minus className="w-4 h-4 text-muted-foreground group-hover:text-terminal-cyan transition-colors" />
      </button>

      {/* Maximize/Restore Button */}
      <button
        onClick={handleMaximize}
        className="group p-2 hover:bg-terminal-cyan/10 transition-colors duration-200 rounded"
        aria-label="Maximize window"
      >
        <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-terminal-cyan transition-colors" />
      </button>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="group p-2 hover:bg-terminal-red/20 transition-colors duration-200 rounded"
        aria-label="Close window"
      >
        <X className="w-4 h-4 text-muted-foreground group-hover:text-terminal-red transition-colors" />
      </button>
    </div>
  );
}
