import { X } from "lucide-react";
import { isTauri } from "../lib/tauri";

export function WindowControls() {
  if (!isTauri()) {
    return null;
  }

  const handleClose = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    // Use close() to trigger CloseRequested event, which handles hide + tray logic
    await win.close();
  };

  return (
    <button
      onClick={handleClose}
      className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      title="Close to tray"
    >
      <X className="w-4 h-4" />
    </button>
  );
}
