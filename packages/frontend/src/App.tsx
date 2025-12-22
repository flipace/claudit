import { useEffect, useRef, useState } from "react";
import { isTauri } from "./lib/tauri";
import type { Window } from "@tauri-apps/api/window";
import { Dashboard } from "./domains/analytics";
import { Settings } from "./domains/settings";
import { ConfigPage } from "./domains/config";
import { AgentsPage } from "./domains/agents";
import { PluginsPage } from "./domains/plugins";
import { ProjectsPage } from "./domains/projects";
import { AnalysisPage } from "./domains/analysis";
import { BackupPage } from "./domains/backup";
import { Sidebar, type Page } from "./components/Sidebar";
import { WindowControls } from "./components/WindowControls";

function App() {
  const [activePage, setActivePage] = useState<Page>("analytics");
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

  const renderPage = () => {
    switch (activePage) {
      case "analytics":
        return <Dashboard />;
      case "settings":
        return <Settings />;
      case "config":
        return <ConfigPage />;
      case "agents":
        return <AgentsPage />;
      case "plugins":
        return <PluginsPage />;
      case "projects":
        return <ProjectsPage />;
      case "analysis":
        return <AnalysisPage />;
      case "backup":
        return <BackupPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div
      className={`h-screen bg-background flex ${isTauri() ? "rounded-xl overflow-hidden" : ""}`}
    >
      {/* Sidebar */}
      <Sidebar activePage={activePage} onPageChange={setActivePage} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - draggable in Tauri */}
        <header
          ref={headerRef}
          className={`sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur ${isTauri() ? "cursor-default select-none" : ""}`}
        >
          <div className="flex h-10 items-center justify-end px-4">
            {isTauri() && <WindowControls />}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{renderPage()}</main>
      </div>
    </div>
  );
}

export default App;
