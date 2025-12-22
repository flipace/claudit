import { useEffect, useRef, useState } from "react";
import { isTauri } from "./lib/tauri";
import type { Window } from "@tauri-apps/api/window";
import { Dashboard } from "./domains/analytics";
import { Settings } from "./domains/settings";
import { BarChart3, Settings as SettingsIcon } from "lucide-react";

type Tab = "analytics" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const tauriWindowRef = useRef<Window | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Set up Tauri window reference
  useEffect(() => {
    if (!isTauri()) return;

    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      tauriWindowRef.current = getCurrentWindow();
    });
  }, []);

  // Set up window dragging for Tauri
  useEffect(() => {
    if (!isTauri() || !headerRef.current) return;

    const header = headerRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.buttons !== 1) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "INPUT" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("a")
      ) {
        return;
      }

      if (tauriWindowRef.current) {
        if (e.detail === 2) {
          tauriWindowRef.current.toggleMaximize();
        } else {
          tauriWindowRef.current.startDragging();
        }
      }
    };

    header.addEventListener("mousedown", handleMouseDown);
    return () => header.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div
      className={`min-h-screen bg-background flex flex-col ${isTauri() ? "rounded-xl overflow-hidden" : ""}`}
    >
      {/* Header - draggable in Tauri */}
      <header
        ref={headerRef}
        className={`sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur ${isTauri() ? "cursor-default select-none" : ""}`}
      >
        <div className="flex h-12 items-center justify-between px-4">
          <h1 className="font-semibold text-foreground">Claudit</h1>
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === "analytics"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 size={14} />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === "settings"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SettingsIcon size={14} />
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === "analytics" ? <Dashboard /> : <Settings />}
      </main>
    </div>
  );
}

export default App;
