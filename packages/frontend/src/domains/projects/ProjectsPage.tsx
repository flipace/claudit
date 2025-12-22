import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  RefreshCw,
  DollarSign,
  Clock,
  Zap,
  Search,
  FileText,
  Server,
  ExternalLink,
  Edit,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Terminal,
  Image,
  ArrowLeft,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

interface ProjectInfo {
  path: string;
  name: string;
  lastCost: number;
  lastSessionId?: string;
  lastDuration: number;
  lastInputTokens: number;
  lastOutputTokens: number;
  hasClaude: boolean;
  mcpServerCount: number;
  lastUsed?: string;
}

interface ProjectDetails {
  path: string;
  name: string;
  claudeMdContent?: string;
  commands: CommandInfo[];
  mcpServers: McpServer[];
  imageUrl?: string;
}

interface CommandInfo {
  name: string;
  path: string;
  description?: string;
  isDirectory: boolean;
}

interface McpServer {
  name: string;
  serverType: string;
  command?: string;
  url?: string;
  args?: string[];
  projectPath?: string;
}

interface ProjectSuggestion {
  suggestion: string;
  projectPath: string;
}

type TabType = "overview" | "claude-md" | "commands" | "mcp" | "suggestions";

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "cost" | "recent">("recent");
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [suggestionCache, setSuggestionCache] = useState<Record<string, string>>({});
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [launchingClaude, setLaunchingClaude] = useState(false);
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);

  // Fetch projects
  const {
    data: projects,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => invoke<ProjectInfo[]>("list_projects"),
  });

  // Fetch project details when selected
  const {
    data: projectDetails,
    isLoading: detailsLoading,
  } = useQuery({
    queryKey: ["projectDetails", selectedProject?.path],
    queryFn: () => invoke<ProjectDetails>("get_project_details", { projectPath: selectedProject!.path }),
    enabled: !!selectedProject,
  });

  // Fetch command content when expanded
  const { data: commandContent, isLoading: commandContentLoading } = useQuery({
    queryKey: ["commandContent", expandedCommand],
    queryFn: () => invoke<string>("get_agent_or_command_content", { path: expandedCommand! }),
    enabled: !!expandedCommand,
  });

  // Mutation for getting AI suggestions
  const suggestionMutation = useMutation({
    mutationFn: (projectPath: string) =>
      invoke<ProjectSuggestion>("get_project_suggestions", { projectPath }),
    onSuccess: (data) => {
      setSuggestionCache((prev) => ({
        ...prev,
        [data.projectPath]: data.suggestion,
      }));
    },
  });

  // Mutation for setting project image
  const setImageMutation = useMutation({
    mutationFn: ({ projectPath, imagePath }: { projectPath: string; imagePath: string }) =>
      invoke<string>("set_project_image", { projectPath, imageSourcePath: imagePath }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectDetails", selectedProject?.path] });
    },
  });

  const filteredProjects = projects
    ?.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let result = 0;
      if (sortBy === "name") {
        result = a.name.localeCompare(b.name);
      } else if (sortBy === "cost") {
        result = b.lastCost - a.lastCost;
      } else {
        result = (b.lastUsed || "").localeCompare(a.lastUsed || "");
      }
      if (result === 0) result = a.name.localeCompare(b.name);
      if (result === 0) result = a.path.localeCompare(b.path);
      return result;
    });

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke("open_folder", { path });
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  };

  const handleOpenInEditor = async (path: string) => {
    try {
      await invoke("open_in_editor", { path });
    } catch (e) {
      console.error("Failed to open in editor:", e);
    }
  };

  const handleSelectImage = async () => {
    if (!selectedProject) return;

    const result = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }],
    });

    if (result) {
      setImageMutation.mutate({
        projectPath: selectedProject.path,
        imagePath: result as string,
      });
    }
  };

  const handleGenerateSuggestions = () => {
    if (!selectedProject) return;
    suggestionMutation.mutate(selectedProject.path);
  };

  const handleCopyPrompt = async () => {
    if (!selectedProject) return;
    const suggestion = suggestionMutation.data?.suggestion || suggestionCache[selectedProject.path];
    if (!suggestion) return;

    const prompt = `Please implement the following improvements for this project:\n\n${suggestion}\n\nImplement these changes following the project's existing patterns and conventions.`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
    }
  };

  const handleRunWithClaude = async () => {
    if (!selectedProject || launchingClaude) return;
    const suggestion = suggestionMutation.data?.suggestion || suggestionCache[selectedProject.path];
    if (!suggestion) return;

    const prompt = `Please implement the following improvements for this project:\n\n${suggestion}\n\nImplement these changes following the project's existing patterns and conventions.`;

    setLaunchingClaude(true);
    try {
      await invoke<string>("run_claude_with_prompt", {
        projectPath: selectedProject.path,
        prompt,
      });
      setLaunchSuccess(true);
      setTimeout(() => {
        setLaunchingClaude(false);
        setLaunchSuccess(false);
      }, 2000);
    } catch (e) {
      console.error("Failed to run Claude:", e);
      setLaunchingClaude(false);
    }
  };

  const formatCost = (cost: number) => {
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    if (cost >= 0.01) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(4)}`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Project Detail View
  if (selectedProject) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedProject(null)}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Project Image */}
            <div
              className="relative w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden group cursor-pointer"
              onClick={handleSelectImage}
            >
              {projectDetails?.imageUrl ? (
                <img
                  src={projectDetails.imageUrl}
                  alt={selectedProject.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FolderOpen className="w-6 h-6 text-amber-500" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Image className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{selectedProject.name}</h1>
              <p className="text-xs text-muted-foreground truncate">{selectedProject.path}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenFolder(selectedProject.path)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
                title="Open folder"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              {selectedProject.hasClaude && (
                <button
                  onClick={() => handleOpenInEditor(`${selectedProject.path}/CLAUDE.md`)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
                  title="Edit CLAUDE.md"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-3 -mb-3">
            {[
              { id: "overview", label: "Overview", icon: LayoutGrid },
              { id: "claude-md", label: "CLAUDE.md", icon: FileText },
              { id: "commands", label: "Commands", icon: Terminal },
              { id: "mcp", label: "MCP Servers", icon: Server },
              { id: "suggestions", label: "AI Suggestions", icon: Sparkles },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors",
                  activeTab === tab.id
                    ? "bg-background text-foreground border-t border-x border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-zinc-800/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "commands" && projectDetails && projectDetails.commands.length > 0 && (
                  <span className="ml-1 text-xs bg-zinc-700 px-1.5 rounded">{projectDetails.commands.length}</span>
                )}
                {tab.id === "mcp" && projectDetails && projectDetails.mcpServers.length > 0 && (
                  <span className="ml-1 text-xs bg-zinc-700 px-1.5 rounded">{projectDetails.mcpServers.length}</span>
                )}
                {tab.id === "suggestions" && suggestionCache[selectedProject.path] && (
                  <span className="ml-1 w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {detailsLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading project details...
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <DollarSign className="w-4 h-4" />
                        Total Cost
                      </div>
                      <div className="text-2xl font-semibold">{formatCost(selectedProject.lastCost)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Clock className="w-4 h-4" />
                        Duration
                      </div>
                      <div className="text-2xl font-semibold">{formatDuration(selectedProject.lastDuration)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Zap className="w-4 h-4" />
                        Input Tokens
                      </div>
                      <div className="text-2xl font-semibold">{formatTokens(selectedProject.lastInputTokens)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Zap className="w-4 h-4" />
                        Output Tokens
                      </div>
                      <div className="text-2xl font-semibold">{formatTokens(selectedProject.lastOutputTokens)}</div>
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                      <h3 className="text-sm font-medium mb-3">Project Info</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last used</span>
                          <span>{formatDate(selectedProject.lastUsed)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Has CLAUDE.md</span>
                          <span>{selectedProject.hasClaude ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MCP Servers</span>
                          <span>{selectedProject.mcpServerCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Commands</span>
                          <span>{projectDetails?.commands.length || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                      <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleOpenFolder(selectedProject.path)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Finder
                        </button>
                        {selectedProject.hasClaude && (
                          <button
                            onClick={() => handleOpenInEditor(`${selectedProject.path}/CLAUDE.md`)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Edit CLAUDE.md
                          </button>
                        )}
                        <button
                          onClick={() => setActiveTab("suggestions")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-md transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                          {suggestionCache[selectedProject.path] ? "View AI Suggestions" : "Get AI Suggestions"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CLAUDE.md Tab */}
              {activeTab === "claude-md" && (
                <div className="space-y-4">
                  {projectDetails?.claudeMdContent ? (
                    <>
                      {/* Action bar */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Project configuration file
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenFolder(`${selectedProject.path}/CLAUDE.md`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open Folder
                          </button>
                          <button
                            onClick={() => handleOpenInEditor(`${selectedProject.path}/CLAUDE.md`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Edit File
                          </button>
                        </div>
                      </div>
                      <div className="rounded-lg bg-zinc-900/50 border border-zinc-800/50 overflow-hidden p-4">
                        <MarkdownViewer content={projectDetails.claudeMdContent} />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="w-12 h-12 mb-3 opacity-50" />
                      <p className="text-lg font-medium">No CLAUDE.md file</p>
                      <p className="text-sm mt-1">Create a CLAUDE.md to configure project-specific settings</p>
                      <button
                        onClick={() => handleOpenInEditor(`${selectedProject.path}/CLAUDE.md`)}
                        className="mt-6 flex items-center gap-2 px-6 py-3 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium"
                      >
                        <Edit className="w-5 h-5" />
                        Create CLAUDE.md
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Commands Tab */}
              {activeTab === "commands" && (
                <div className="space-y-3">
                  {projectDetails?.commands && projectDetails.commands.length > 0 ? (
                    projectDetails.commands.map((cmd) => (
                      <div
                        key={cmd.path}
                        className="rounded-lg bg-zinc-900/50 border border-zinc-800/50 overflow-hidden"
                      >
                        {/* Command Header - Clickable to expand */}
                        <button
                          onClick={() => setExpandedCommand(expandedCommand === cmd.path ? null : cmd.path)}
                          className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Terminal className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="text-left">
                              <div className="font-medium">/{cmd.name}</div>
                              {cmd.description && (
                                <div className="text-xs text-muted-foreground line-clamp-1">{cmd.description}</div>
                              )}
                              {!cmd.description && (
                                <div className="text-xs text-muted-foreground">Click to view content</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenFolder(cmd.path); }}
                              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50"
                              title="Open folder"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenInEditor(cmd.path); }}
                              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50"
                              title="Edit file"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <ChevronDown
                              className={cn(
                                "w-5 h-5 text-muted-foreground transition-transform",
                                expandedCommand === cmd.path && "rotate-180"
                              )}
                            />
                          </div>
                        </button>

                        {/* Expandable Content */}
                        <AnimatePresence>
                          {expandedCommand === cmd.path && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 border-t border-zinc-800/50">
                                {commandContentLoading ? (
                                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Loading...
                                  </div>
                                ) : commandContent ? (
                                  <div className="pt-4">
                                    <MarkdownViewer content={commandContent} />
                                  </div>
                                ) : (
                                  <div className="text-center text-muted-foreground py-4">
                                    Failed to load content
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Terminal className="w-12 h-12 mb-3 opacity-50" />
                      <p className="text-lg font-medium">No project-specific commands</p>
                      <p className="text-sm mt-1">Create commands in .claude/commands/ folder</p>
                      <button
                        onClick={() => handleOpenFolder(`${selectedProject.path}/.claude/commands`)}
                        className="mt-4 flex items-center gap-2 px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" />
                        Open Commands Folder
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MCP Servers Tab */}
              {activeTab === "mcp" && (
                <div className="space-y-3">
                  {projectDetails?.mcpServers && projectDetails.mcpServers.length > 0 ? (
                    projectDetails.mcpServers.map((server) => (
                      <div
                        key={server.name}
                        className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                              <Server className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                              <div className="font-medium">{server.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {server.serverType === "stdio" ? "Local process" : "HTTP connection"}
                              </div>
                            </div>
                          </div>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            server.serverType === "stdio" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"
                          )}>
                            {server.serverType}
                          </span>
                        </div>

                        {/* Server Details */}
                        <div className="space-y-2 text-sm pl-13">
                          {server.command && (
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground text-xs w-16 flex-shrink-0">Command:</span>
                              <code className="text-xs bg-zinc-800 px-2 py-0.5 rounded font-mono">{server.command}</code>
                            </div>
                          )}
                          {server.args && server.args.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground text-xs w-16 flex-shrink-0">Args:</span>
                              <div className="flex flex-wrap gap-1">
                                {server.args.map((arg, i) => (
                                  <code key={i} className="text-xs bg-zinc-800 px-2 py-0.5 rounded font-mono">{arg}</code>
                                ))}
                              </div>
                            </div>
                          )}
                          {server.url && (
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground text-xs w-16 flex-shrink-0">URL:</span>
                              <code className="text-xs bg-zinc-800 px-2 py-0.5 rounded font-mono break-all">{server.url}</code>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Server className="w-12 h-12 mb-3 opacity-50" />
                      <p className="text-lg font-medium">No project-specific MCP servers</p>
                      <p className="text-sm mt-1">MCP servers extend Claude's capabilities</p>
                      <p className="text-xs mt-3 max-w-md text-center">
                        Add MCP servers in ~/.claude.json under this project's config, or use the global MCP settings.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Suggestions Tab */}
              {activeTab === "suggestions" && (
                <div className="space-y-4">
                  {suggestionMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mb-3 text-amber-500" />
                      <p className="text-sm">Analyzing project with Claude...</p>
                      <p className="text-xs mt-1">This may take a moment</p>
                    </div>
                  ) : suggestionMutation.isError ? (
                    <div className="flex flex-col items-center justify-center py-12 text-red-400">
                      <p className="text-sm font-medium mb-2">Failed to get suggestions</p>
                      <p className="text-xs text-center max-w-sm">
                        {suggestionMutation.error instanceof Error
                          ? suggestionMutation.error.message
                          : "Unknown error occurred"}
                      </p>
                      <button
                        onClick={handleGenerateSuggestions}
                        className="mt-4 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (suggestionMutation.isSuccess && suggestionMutation.data) || suggestionCache[selectedProject.path] ? (
                    <>
                      <div className="rounded-lg bg-zinc-900/50 border border-zinc-800/50 p-4">
                        <MarkdownViewer content={suggestionMutation.data?.suggestion || suggestionCache[selectedProject.path]} />
                      </div>

                      {/* Action Footer */}
                      <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                        <p className="text-xs text-muted-foreground">
                          {launchSuccess
                            ? "Prompt copied! Paste into Claude Code"
                            : "Copy prompt or open Terminal in project folder"}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleGenerateSuggestions}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Regenerate
                          </button>
                          <button
                            onClick={handleCopyPrompt}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                          >
                            {copiedPrompt ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-500" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy Prompt
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleRunWithClaude}
                            disabled={launchingClaude}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors disabled:opacity-70"
                          >
                            {launchSuccess ? (
                              <>
                                <Check className="w-4 h-4" />
                                Copied & Opened!
                              </>
                            ) : launchingClaude ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Launching...
                              </>
                            ) : (
                              <>
                                <Terminal className="w-4 h-4" />
                                Open Terminal
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Sparkles className="w-12 h-12 mb-3 opacity-50" />
                      <p className="text-lg font-medium">AI Suggestions</p>
                      <p className="text-sm mt-1">Get personalized suggestions to improve your project workflow</p>
                      <button
                        onClick={handleGenerateSuggestions}
                        className="mt-6 flex items-center gap-2 px-6 py-3 text-sm bg-amber-500 text-black hover:bg-amber-400 rounded-lg transition-colors font-medium"
                      >
                        <Sparkles className="w-5 h-5" />
                        Generate AI Suggestions
                      </button>
                      <p className="text-xs mt-3 text-muted-foreground">Uses Claude CLI to analyze your project</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Project List View
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Projects"
        description="Your Claude Code projects. Click on a project to view details, commands, MCP servers, and get AI suggestions."
      />

      {/* Controls */}
      <div className="px-4 py-3 border-b border-border bg-zinc-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            <span className="font-medium">{projects?.length || 0} projects</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="cost">Cost</option>
            </select>
            <button
              onClick={() => refetch()}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Project Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading projects...
          </div>
        ) : filteredProjects && filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <motion.button
                key={project.path}
                onClick={() => {
                  setSelectedProject(project);
                  setActiveTab("overview");
                }}
                className="text-left p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start gap-3">
                  {/* Project Image/Icon */}
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <FolderOpen className="w-6 h-6 text-amber-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {formatDate(project.lastUsed)}
                    </p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {project.lastCost > 0 && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
                      {formatCost(project.lastCost)}
                    </span>
                  )}
                  {project.hasClaude && (
                    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      <FileText className="w-3 h-3" />
                      CLAUDE.md
                    </span>
                  )}
                  {project.mcpServerCount > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full">
                      <Server className="w-3 h-3" />
                      {project.mcpServerCount}
                    </span>
                  )}
                  {suggestionCache[project.path] && (
                    <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No projects found</p>
            <p className="text-sm">Projects will appear here as you use Claude Code</p>
          </div>
        )}
      </div>
    </div>
  );
}
