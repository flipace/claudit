import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
  Bot,
  Terminal,
  Search,
  RefreshCw,
  ChevronRight,
  FolderOpen,
  X,
  ExternalLink,
  Edit,
} from "lucide-react";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { PageHeader } from "../../components/PageHeader";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface AgentInfo {
  name: string;
  path: string;
  description?: string;
  isDirectory: boolean;
}

interface CommandInfo {
  name: string;
  path: string;
  description?: string;
  isDirectory: boolean;
}

type ItemType = "agent" | "command";

export function AgentsPage() {
  const [activeTab, setActiveTab] = useState<ItemType>("agent");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<{
    type: ItemType;
    path: string;
    name: string;
  } | null>(null);

  // Fetch agents
  const {
    data: agents,
    isLoading: agentsLoading,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["agents"],
    queryFn: () => invoke<AgentInfo[]>("list_agents"),
  });

  // Fetch commands
  const {
    data: commands,
    isLoading: commandsLoading,
    refetch: refetchCommands,
  } = useQuery({
    queryKey: ["commands"],
    queryFn: () => invoke<CommandInfo[]>("list_commands"),
  });

  // Fetch selected item content
  const { data: itemContent, isLoading: contentLoading } = useQuery({
    queryKey: ["item-content", selectedItem?.type, selectedItem?.path],
    queryFn: () =>
      invoke<string>("get_agent_or_command_content", {
        path: selectedItem!.path,
      }),
    enabled: !!selectedItem,
  });

  const filteredAgents =
    agents?.filter((a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const filteredCommands =
    commands?.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const currentItems = activeTab === "agent" ? filteredAgents : filteredCommands;
  const isLoading = activeTab === "agent" ? agentsLoading : commandsLoading;

  const handleOpenInEditor = async (path: string) => {
    try {
      await invoke("open_in_editor", { path });
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke("open_folder", { path });
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Agents & Slash Commands"
        description="Custom agents extend Claude's capabilities for specialized tasks. Slash commands (like /commit) provide quick shortcuts. Create your own in ~/.claude/agents/ and ~/.claude/commands/."
      />
      <div className="flex-1 flex min-h-0">
        {/* Main List */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-zinc-900/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab("agent")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                    activeTab === "agent"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Bot className="w-4 h-4" />
                  Agents
                  {agents && (
                    <span className="text-xs opacity-70">({agents.length})</span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("command")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                    activeTab === "command"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Terminal className="w-4 h-4" />
                  Commands
                  {commands && (
                    <span className="text-xs opacity-70">({commands.length})</span>
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() =>
                activeTab === "agent" ? refetchAgents() : refetchCommands()
              }
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading {activeTab}s...
            </div>
          ) : currentItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No {activeTab}s found</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {currentItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() =>
                    setSelectedItem({
                      type: activeTab,
                      path: item.path,
                      name: item.name,
                    })
                  }
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    "bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50",
                    selectedItem?.path === item.path &&
                      "border-primary/50 bg-primary/5"
                  )}
                >
                  {item.isDirectory ? (
                    <FolderOpen className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  ) : activeTab === "agent" ? (
                    <Bot className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <Terminal className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Preview Panel */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 480, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-border bg-zinc-900/30 flex flex-col overflow-hidden"
            >
              {/* Preview Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedItem.type === "agent" ? (
                    <Bot className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Terminal className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                  <span className="font-medium truncate">{selectedItem.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenFolder(selectedItem.path)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800/50 transition-colors"
                    title="Open Folder"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenInEditor(selectedItem.path)}
                    className="p-1.5 text-primary hover:text-primary/80 rounded hover:bg-primary/10 transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800/50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-auto p-4">
                {contentLoading ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </div>
                ) : itemContent ? (
                  <MarkdownViewer content={itemContent} />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Failed to load content
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
