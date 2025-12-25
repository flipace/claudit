import { useState, useEffect } from "react";
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
  FileText,
  File,
} from "lucide-react";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { PageHeader } from "../../components/PageHeader";
import { cn } from "../../lib/utils";

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

interface DirectoryFile {
  name: string;
  path: string;
  isMarkdown: boolean;
}

type ItemType = "agent" | "command";

export function AgentsPage() {
  const [activeTab, setActiveTab] = useState<ItemType>("agent");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<{
    type: ItemType;
    path: string;
    name: string;
    isDirectory: boolean;
  } | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

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

  // Fetch directory files for selected directory
  const { data: directoryFiles } = useQuery({
    queryKey: ["directory-files", selectedItem?.path],
    queryFn: () =>
      invoke<DirectoryFile[]>("list_directory_files", {
        path: selectedItem!.path,
      }),
    enabled: !!selectedItem?.isDirectory,
  });

  // Auto-select first file when directory files are loaded
  useEffect(() => {
    if (directoryFiles && directoryFiles.length > 0 && !selectedFilePath) {
      setSelectedFilePath(directoryFiles[0].path);
    }
  }, [directoryFiles, selectedFilePath]);

  // Reset selected file when item changes
  useEffect(() => {
    setSelectedFilePath(null);
  }, [selectedItem?.path]);

  // Determine which path to fetch content for
  const contentPath = selectedItem?.isDirectory
    ? selectedFilePath
    : selectedItem?.path;

  // Fetch selected item content
  const { data: itemContent, isLoading: contentLoading } = useQuery({
    queryKey: ["item-content", contentPath],
    queryFn: () =>
      invoke<string>("get_agent_or_command_content", {
        path: contentPath!,
      }),
    enabled: !!contentPath,
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
        {/* Left - List Panel */}
        <div className="w-80 shrink-0 flex flex-col border-r border-border">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-zinc-900/30 shrink-0">
            <div className="flex items-center justify-between mb-3">
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
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
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
              <div className="flex flex-col gap-2">
                {currentItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() =>
                      setSelectedItem({
                        type: activeTab,
                        path: item.path,
                        name: item.name,
                        isDirectory: item.isDirectory,
                      })
                    }
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                      "bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50",
                      selectedItem?.path === item.path &&
                        "border-primary/50 bg-primary/5"
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      {activeTab === "agent" ? (
                        <Bot className="w-5 h-5 text-primary" />
                      ) : (
                        <Terminal className="w-5 h-5 text-emerald-500" />
                      )}
                      {item.isDirectory && (
                        <FolderOpen className="w-3 h-3 text-amber-500 absolute -bottom-1 -right-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description || (item.isDirectory ? "Directory" : "File")}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right - Preview Panel */}
        <div className="flex-1 min-w-0 flex flex-col bg-zinc-900/30">
          {selectedItem ? (
            <>
              {/* Preview Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedItem.type === "agent" ? (
                    <Bot className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Terminal className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                  <span className="font-medium truncate">{selectedItem.name}</span>
                  {selectedItem.isDirectory && (
                    <span className="text-xs text-muted-foreground">(directory)</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenFolder(selectedItem.path)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800/50 transition-colors"
                    title="Open in Finder"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenInEditor(selectedFilePath || selectedItem.path)}
                    className="p-1.5 text-primary hover:text-primary/80 rounded hover:bg-primary/10 transition-colors"
                    title="Edit in Editor"
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

              {/* File Tabs for Directories */}
              {selectedItem.isDirectory && directoryFiles && directoryFiles.length > 0 && (
                <div className="flex gap-1 px-4 py-2 border-b border-border bg-zinc-950/50 overflow-x-auto shrink-0">
                  {directoryFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap",
                        selectedFilePath === file.path
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-zinc-800/50"
                      )}
                    >
                      {file.isMarkdown ? (
                        <FileText className="w-3 h-3" />
                      ) : (
                        <File className="w-3 h-3" />
                      )}
                      {file.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Preview Content */}
              <div className="flex-1 overflow-auto p-4 min-h-0">
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Bot className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Select an item to preview</p>
              <p className="text-sm mt-1">
                Choose an {activeTab} from the list to view its content
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
