import { useState, useEffect } from "react";
import {
  BarChart3,
  Settings,
  FileText,
  Bot,
  Plug,
  FolderOpen,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Heart,
  Github,
  Globe,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { getVersion } from "@tauri-apps/api/app";

export type Page =
  | "analytics"
  | "settings"
  | "config"
  | "agents"
  | "plugins"
  | "projects"
  | "analysis"
  | "backup";

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart3 size={20} />,
    description: "Usage stats & costs",
  },
  {
    id: "config",
    label: "CLAUDE.md",
    icon: <FileText size={20} />,
    description: "Config files",
  },
  {
    id: "agents",
    label: "Agents & Commands",
    icon: <Bot size={20} />,
    description: "Custom agents",
  },
  {
    id: "plugins",
    label: "Plugins & MCP",
    icon: <Plug size={20} />,
    description: "MCP servers",
  },
  {
    id: "projects",
    label: "Projects",
    icon: <FolderOpen size={20} />,
    description: "Your projects",
  },
  {
    id: "analysis",
    label: "Chat Analysis",
    icon: <Search size={20} />,
    description: "AI insights",
  },
  {
    id: "backup",
    label: "Backup & Export",
    icon: <Download size={20} />,
    description: "Export config",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings size={20} />,
    description: "Preferences",
  },
];

interface SidebarProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
}

export function Sidebar({ activePage, onPageChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="flex flex-col h-full bg-zinc-900/50 backdrop-blur-sm border-r border-zinc-800/50"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 p-4 border-b border-zinc-800/50">
        <img src="/icon.png" alt="Claudit" className="w-7 h-7 rounded" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="font-semibold text-foreground overflow-hidden whitespace-nowrap"
            >
              Claudit
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPageChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
              activePage === item.id
                ? "bg-primary/10 text-primary border-r-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-zinc-800/50"
            )}
            title={collapsed ? item.label : undefined}
          >
            <span className="flex-shrink-0 w-5 flex items-center justify-center">{item.icon}</span>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden flex-1 min-w-0"
                >
                  <div className="whitespace-nowrap">
                    <div className="font-medium leading-tight">{item.label}</div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      {item.description}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        ))}
      </nav>

      {/* Version, Support & Collapse Toggle */}
      <div className="border-t border-zinc-800/50">
        <AnimatePresence>
          {!collapsed && version && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 text-xs text-muted-foreground overflow-hidden text-center"
            >
              v{version}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center gap-1 py-2 overflow-hidden"
            >
              <button
                onClick={() => open("https://github.com/flipace/claudit")}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-zinc-800/50 rounded-md transition-colors"
                title="GitHub"
              >
                <Github size={16} />
              </button>
              <button
                onClick={() => open("https://claudit.cloud.neschkudla.at")}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-zinc-800/50 rounded-md transition-colors"
                title="Website"
              >
                <Globe size={16} />
              </button>
              <button
                onClick={() => open("https://buymeacoffee.com/flipace")}
                className="p-2 text-muted-foreground hover:text-pink-400 hover:bg-zinc-800/50 rounded-md transition-colors"
                title="Support"
              >
                <Heart size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-3 text-muted-foreground hover:text-foreground transition-colors"
          title={collapsed && version ? `v${version}` : undefined}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </motion.aside>
  );
}
