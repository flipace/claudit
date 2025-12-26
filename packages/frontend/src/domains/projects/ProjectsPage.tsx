import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import Fuse from "fuse.js";
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
  MessageSquare,
  ChevronRight,
  Bot,
  Plus,
  Trash2,
  X,
  File,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { McpServerCard, type McpServer } from "../../components/McpServerCard";
import { type CommandInfo, type DirectoryFile } from "../../components/CommandCard";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Skeleton, SkeletonProjectCard, SkeletonSessionItem } from "../../components/Skeleton";
import { ConversationViewer } from "./components";
import type { SessionInfo, SessionConversation, SessionSearchResult } from "../../types";

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

interface ProjectSuggestion {
  suggestion: string;
  projectPath: string;
}

type TabType = "overview" | "claude-md" | "commands" | "mcp" | "suggestions" | "sessions";

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
  const [selectedCommand, setSelectedCommand] = useState<CommandInfo | null>(null);
  const [selectedCommandFile, setSelectedCommandFile] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const sessionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [showWarmupSessions, setShowWarmupSessions] = useState(false);

  // MCP Server management state
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);
  const [mcpServerName, setMcpServerName] = useState("");
  const [mcpServerConfig, setMcpServerConfig] = useState("");
  const [deleteMcpConfirm, setDeleteMcpConfirm] = useState<McpServer | null>(null);
  const [removingMcpServer, setRemovingMcpServer] = useState<string | null>(null);

  // Debounce session search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(sessionSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [sessionSearchQuery]);

  // Auto-scroll to selected session
  useEffect(() => {
    if (selectedSession && activeTab === "sessions") {
      const element = sessionRefs.current.get(selectedSession);
      if (element) {
        // Small delay to ensure the DOM is ready
        requestAnimationFrame(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    }
  }, [selectedSession, activeTab]);

  // Escape key handler for MCP modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mcpModalOpen) closeMcpModal();
        if (deleteMcpConfirm) setDeleteMcpConfirm(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mcpModalOpen, deleteMcpConfirm]);

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

  // Fetch directory files when a directory command is selected
  const { data: commandDirectoryFiles, isLoading: commandFilesLoading } = useQuery({
    queryKey: ["commandDirectoryFiles", selectedCommand?.path],
    queryFn: () => invoke<DirectoryFile[]>("list_directory_files", { path: selectedCommand!.path }),
    enabled: !!selectedCommand?.isDirectory,
  });

  // Auto-select first file when directory files are loaded
  useEffect(() => {
    if (commandDirectoryFiles && commandDirectoryFiles.length > 0 && !selectedCommandFile) {
      setSelectedCommandFile(commandDirectoryFiles[0].path);
    }
  }, [commandDirectoryFiles, selectedCommandFile]);

  // Reset selected file when selected command changes
  useEffect(() => {
    setSelectedCommandFile(null);
  }, [selectedCommand?.path]);

  // Determine which path to fetch content for (file in directory or command itself)
  const commandContentPath = selectedCommand?.isDirectory
    ? selectedCommandFile
    : selectedCommand?.path;

  // Fetch command content when selected
  const { data: commandContent, isLoading: commandContentLoading } = useQuery({
    queryKey: ["commandContent", commandContentPath],
    queryFn: () => invoke<string>("get_agent_or_command_content", { path: commandContentPath! }),
    enabled: !!commandContentPath,
  });

  // Fetch sessions for the project (needed for both overview and sessions tabs)
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["projectSessions", selectedProject?.path],
    queryFn: () => invoke<SessionInfo[]>("list_project_sessions", { projectPath: selectedProject!.path }),
    enabled: !!selectedProject && (activeTab === "sessions" || activeTab === "overview"),
  });

  // Recent sessions for overview (exclude warmup, limit to 10)
  const recentSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .filter(s => {
        const title = s.summary || s.first_user_message || "";
        return title.toLowerCase() !== "warmup";
      })
      .slice(0, 10);
  }, [sessions]);

  // Fetch conversation for selected session
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ["sessionConversation", selectedProject?.path, selectedSession],
    queryFn: () => invoke<SessionConversation>("get_session_conversation", {
      projectPath: selectedProject!.path,
      sessionId: selectedSession!
    }),
    enabled: !!selectedProject && !!selectedSession,
  });

  // Search session message content (backend search)
  const { data: contentSearchResults, isLoading: contentSearchLoading } = useQuery({
    queryKey: ["sessionContentSearch", selectedProject?.path, debouncedSearchQuery],
    queryFn: () => invoke<SessionSearchResult[]>("search_project_sessions", {
      projectPath: selectedProject!.path,
      query: debouncedSearchQuery
    }),
    enabled: !!selectedProject && activeTab === "sessions" && debouncedSearchQuery.length >= 2,
    staleTime: 60000, // Cache for 1 minute
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

  // MCP Server mutations
  const updateProjectMcpMutation = useMutation({
    mutationFn: ({ projectPath, name, configJson }: { projectPath: string; name: string; configJson: string }) =>
      invoke("update_project_mcp_server", { projectPath, name, configJson }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectDetails", selectedProject?.path] });
      closeMcpModal();
    },
  });

  const removeProjectMcpMutation = useMutation({
    mutationFn: ({ projectPath, name }: { projectPath: string; name: string }) =>
      invoke("remove_project_mcp_server", { projectPath, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectDetails", selectedProject?.path] });
      setRemovingMcpServer(null);
    },
    onError: () => {
      setRemovingMcpServer(null);
    },
  });

  // MCP Modal handlers
  const closeMcpModal = () => {
    setMcpModalOpen(false);
    setEditingMcpServer(null);
    setMcpServerName("");
    setMcpServerConfig("");
  };

  const openEditMcpModal = (server: McpServer) => {
    setEditingMcpServer(server);
    setMcpServerName(server.name);
    const { name: _, serverType: __, projectPath: ___, ...configFields } = server;
    const config = Object.fromEntries(
      Object.entries(configFields).filter(([, v]) => v !== undefined)
    );
    setMcpServerConfig(JSON.stringify(config, null, 2));
    setMcpModalOpen(true);
  };

  const handleRemoveMcpServer = (server: McpServer) => {
    setDeleteMcpConfirm(server);
  };

  const confirmRemoveMcpServer = () => {
    if (!deleteMcpConfirm || !selectedProject) return;
    setRemovingMcpServer(deleteMcpConfirm.name);
    removeProjectMcpMutation.mutate({
      projectPath: selectedProject.path,
      name: deleteMcpConfirm.name,
    });
    setDeleteMcpConfirm(null);
  };

  const validateMcpJson = (json: string): string | null => {
    try {
      JSON.parse(json);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  };

  const mcpJsonError = mcpServerConfig ? validateMcpJson(mcpServerConfig) : null;

  const handleSaveMcpServer = () => {
    if (!mcpServerName.trim() || mcpJsonError || !selectedProject) return;
    updateProjectMcpMutation.mutate({
      projectPath: selectedProject.path,
      name: mcpServerName,
      configJson: mcpServerConfig,
    });
  };

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

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleCopyResumeCmd = async (sessionId: string) => {
    try {
      await navigator.clipboard.writeText(`claude --resume ${sessionId}`);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const handleOpenTerminalWithResume = async (sessionId: string) => {
    if (!selectedProject) return;
    try {
      await invoke("open_terminal_with_resume", { projectPath: selectedProject.path, sessionId });
    } catch (e) {
      console.error("Failed to open terminal:", e);
    }
  };

  const getSessionTitle = (session: SessionInfo | SessionSearchResult) => {
    return session.summary || session.first_user_message || "Untitled Session";
  };

  // Fuse.js instance for fuzzy title search (excludes warmup sessions)
  const fuse = useMemo(() => {
    if (!sessions) return null;
    const nonWarmups = sessions.filter(s => {
      const title = s.summary || s.first_user_message || "";
      return title.toLowerCase() !== "warmup";
    });
    return new Fuse(nonWarmups, {
      keys: ['summary', 'first_user_message'],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
    });
  }, [sessions]);

  // Helper to check if a session is a warmup
  const isWarmupSession = (session: SessionInfo) => {
    const title = session.summary || session.first_user_message || "";
    return title.toLowerCase() === "warmup";
  };

  // Combined search: Fuse.js for titles + backend for content
  const { filteredSessions, contentMatches, warmupSessions } = useMemo(() => {
    if (!sessions) return { filteredSessions: [], contentMatches: new Map<string, SessionSearchResult>(), warmupSessions: [] };

    // Separate warmup sessions
    const warmups = sessions.filter(isWarmupSession);
    const nonWarmups = sessions.filter(s => !isWarmupSession(s));

    // No search query - return non-warmup sessions (warmups shown separately)
    if (!debouncedSearchQuery) {
      return { filteredSessions: nonWarmups, contentMatches: new Map(), warmupSessions: warmups };
    }

    // Use Fuse.js for title/summary search (only on non-warmup sessions)
    const titleResults = fuse?.search(debouncedSearchQuery) || [];
    const titleMatchIds = new Set(titleResults.map(r => r.item.session_id));

    // Get content search results from backend
    const contentMatchMap = new Map<string, SessionSearchResult>();
    if (contentSearchResults) {
      contentSearchResults.forEach(result => {
        if (!titleMatchIds.has(result.session_id)) {
          contentMatchMap.set(result.session_id, result);
        }
      });
    }

    // Combine: title matches first, then content matches
    const combined: SessionInfo[] = [];

    // Add title matches (sorted by Fuse score), excluding warmups
    titleResults.forEach(r => {
      if (!isWarmupSession(r.item)) {
        combined.push(r.item);
      }
    });

    // Add content matches (sessions not in title results), excluding warmups
    if (contentSearchResults) {
      contentSearchResults.forEach(result => {
        if (!titleMatchIds.has(result.session_id)) {
          // Find the full session info
          const session = sessions.find(s => s.session_id === result.session_id);
          if (session && !combined.some(s => s.session_id === session.session_id) && !isWarmupSession(session)) {
            combined.push(session);
          }
        }
      });
    }

    return { filteredSessions: combined, contentMatches: contentMatchMap, warmupSessions: warmups };
  }, [sessions, debouncedSearchQuery, fuse, contentSearchResults]);

  const handleExportSession = async (sessionId: string) => {
    if (!selectedProject) return;
    try {
      const html = await invoke<string>("export_session_to_html", {
        projectPath: selectedProject.path,
        sessionId
      });

      const path = await save({
        defaultPath: `claude-session-${sessionId.slice(0, 8)}.html`,
        filters: [{ name: "HTML", extensions: ["html"] }]
      });

      if (path) {
        await writeTextFile(path, html);
      }
    } catch (e) {
      console.error("Failed to export session:", e);
    }
  };

  // Project Detail View
  if (selectedProject) {
    return (
      <>
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
              { id: "sessions", label: "Sessions", icon: MessageSquare },
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
                {tab.id === "sessions" && sessions && sessions.length > 0 && (
                  <span className="ml-1 text-xs bg-zinc-700 px-1.5 rounded">{sessions.length}</span>
                )}
                {tab.id === "suggestions" && suggestionCache[selectedProject.path] && (
                  <span className="ml-1 w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className={cn(
          "flex-1 min-h-0",
          activeTab === "commands" || activeTab === "sessions" ? "flex" : "overflow-y-auto p-4"
        )}>
          {detailsLoading ? (
            <div className="space-y-6">
              {/* Skeleton Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
              {/* Skeleton Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <Skeleton className="h-4 w-24 mb-4" />
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <Skeleton className="h-4 w-24 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                </div>
              </div>
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

                  {/* Recent Sessions */}
                  <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Recent Sessions
                      </h3>
                      {recentSessions.length > 0 && (
                        <button
                          onClick={() => setActiveTab("sessions")}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          View all →
                        </button>
                      )}
                    </div>
                    {sessionsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-zinc-800/30">
                            <Skeleton className="w-8 h-8 rounded" />
                            <div className="flex-1">
                              <Skeleton className="h-4 w-40 mb-1" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recentSessions.length > 0 ? (
                      <div className="space-y-1">
                        {recentSessions.map((session) => (
                          <button
                            key={session.session_id}
                            onClick={() => {
                              setActiveTab("sessions");
                              setSelectedSession(session.session_id);
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-800/50 transition-colors text-left group"
                          >
                            <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-purple-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate group-hover:text-primary transition-colors">
                                {getSessionTitle(session)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(session.first_message_at)} • {session.message_count} msgs
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No sessions yet
                      </p>
                    )}
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

              {/* Commands Tab - 2 Column Layout */}
              {activeTab === "commands" && (
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  {/* Left - Command List */}
                  <div className="w-80 shrink-0 flex flex-col border-r border-border">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
                      {projectDetails?.commands && projectDetails.commands.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {projectDetails.commands.map((cmd) => (
                            <button
                              key={cmd.path}
                              onClick={() => setSelectedCommand(cmd)}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                                "bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50",
                                selectedCommand?.path === cmd.path && "border-primary/50 bg-primary/5"
                              )}
                            >
                              <div className="relative shrink-0">
                                <Terminal className="w-5 h-5 text-emerald-500" />
                                {cmd.isDirectory && (
                                  <FolderOpen className="w-3 h-3 text-amber-500 absolute -bottom-1 -right-1" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">/{cmd.name}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {cmd.description || (cmd.isDirectory ? "Directory" : "File")}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                          <Terminal className="w-12 h-12 mb-3 opacity-50" />
                          <p className="font-medium">No commands</p>
                          <p className="text-sm mt-1">Create commands in .claude/commands/</p>
                          <button
                            onClick={() => handleOpenFolder(`${selectedProject.path}/.claude/commands`)}
                            className="mt-3 text-xs text-primary hover:underline"
                          >
                            Open folder
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right - Preview Panel */}
                  <div className="flex-1 min-w-0 flex flex-col bg-zinc-900/30">
                    {selectedCommand ? (
                      <>
                        {/* Preview Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Terminal className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="font-medium truncate">/{selectedCommand.name}</span>
                            {selectedCommand.isDirectory && (
                              <span className="text-xs text-muted-foreground">(directory)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenFolder(selectedCommand.path)}
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800/50 transition-colors"
                              title="Open in Finder"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenInEditor(selectedCommandFile || selectedCommand.path)}
                              className="p-1.5 text-primary hover:text-primary/80 rounded hover:bg-primary/10 transition-colors"
                              title="Edit in Editor"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSelectedCommand(null)}
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800/50 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* File Tabs for Directories */}
                        {selectedCommand.isDirectory && commandDirectoryFiles && commandDirectoryFiles.length > 0 && (
                          <div className="flex gap-1 px-4 py-2 border-b border-border bg-zinc-950/50 overflow-x-auto shrink-0">
                            {commandDirectoryFiles.map((file) => (
                              <button
                                key={file.path}
                                onClick={() => setSelectedCommandFile(file.path)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap",
                                  selectedCommandFile === file.path
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
                          {commandFilesLoading ? (
                            <div className="flex items-center justify-center h-32 text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Loading files...
                            </div>
                          ) : commandContentLoading ? (
                            <div className="flex items-center justify-center h-32 text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Loading...
                            </div>
                          ) : commandContent ? (
                            <MarkdownViewer content={commandContent} />
                          ) : (
                            <div className="text-center text-muted-foreground py-8">
                              {selectedCommand.isDirectory && (!commandDirectoryFiles || commandDirectoryFiles.length === 0)
                                ? "No files in directory"
                                : "Failed to load content"}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                        <Terminal className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-lg font-medium">Select a command to preview</p>
                        <p className="text-sm mt-1">Choose a command from the list</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MCP Servers Tab */}
              {activeTab === "mcp" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Project-specific MCP servers for {selectedProject.name}
                    </p>
                    <button
                      onClick={() => setMcpModalOpen(true)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Server
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {projectDetails?.mcpServers && projectDetails.mcpServers.length > 0 ? (
                      projectDetails.mcpServers.map((server) => (
                        <McpServerCard
                          key={server.name}
                          server={{ ...server, projectPath: selectedProject.path }}
                          onOpenFolder={handleOpenFolder}
                          onEdit={() => openEditMcpModal(server)}
                          onRemove={() => handleRemoveMcpServer(server)}
                          isRemoving={removingMcpServer === server.name}
                        />
                      ))
                    ) : (
                      <div className="col-span-2 flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Server className="w-12 h-12 mb-3 opacity-50" />
                        <p className="text-lg font-medium">No project-specific MCP servers</p>
                        <p className="text-sm mt-1">MCP servers extend Claude's capabilities</p>
                        <button
                          onClick={() => setMcpModalOpen(true)}
                          className="mt-4 flex items-center gap-2 px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add First Server
                        </button>
                      </div>
                    )}
                  </div>
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

              {/* Sessions Tab */}
              {activeTab === "sessions" && (
                <div className="flex-1 flex gap-4 min-h-0 overflow-hidden p-4">
                  {/* Session List */}
                  <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
                    {/* Search */}
                    <div className="relative mb-2 flex-shrink-0">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search sessions..."
                        value={sessionSearchQuery}
                        onChange={(e) => setSessionSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {sessionSearchQuery ? (
                        <button
                          onClick={() => setSessionSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : contentSearchLoading && debouncedSearchQuery.length >= 2 ? (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                      ) : null}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2">
                      {sessionsLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <SkeletonSessionItem key={i} />
                          ))}
                        </div>
                      ) : (filteredSessions && filteredSessions.length > 0) || warmupSessions.length > 0 ? (
                        <>
                          {/* Regular sessions */}
                          {filteredSessions.map((session) => {
                            const contentMatch = contentMatches.get(session.session_id);
                            const title = getSessionTitle(session);

                            return (
                              <button
                                key={session.session_id}
                                ref={(el) => {
                                  if (el) sessionRefs.current.set(session.session_id, el);
                                  else sessionRefs.current.delete(session.session_id);
                                }}
                                onClick={() => setSelectedSession(session.session_id)}
                                className={cn(
                                  "w-full text-left p-3 rounded-lg border transition-colors overflow-hidden",
                                  selectedSession === session.session_id
                                    ? "bg-primary/10 border-primary/50"
                                    : "bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800/50"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <p className="text-sm font-medium truncate">
                                      {title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {formatDateTime(session.first_message_at)}
                                    </p>
                                  </div>
                                  <ChevronRight className={cn(
                                    "w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform",
                                    selectedSession === session.session_id && "rotate-90"
                                  )} />
                                </div>
                                {/* Content match context */}
                                {contentMatch && (
                                  <div className="mt-2 p-2 bg-amber-500/10 rounded text-xs text-amber-400/80 overflow-hidden">
                                    <div className="flex items-center gap-1 mb-1 text-amber-500">
                                      <Search className="w-3 h-3" />
                                      <span className="font-medium">
                                        Match in {contentMatch.message_role === "user" ? "user" : "assistant"} message
                                      </span>
                                    </div>
                                    <p className="truncate text-foreground/70">{contentMatch.match_context}</p>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">
                                    {session.message_count} msgs
                                  </span>
                                  <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">
                                    {formatTokens(session.total_input_tokens + session.total_output_tokens)} tokens
                                  </span>
                                  {session.total_cost > 0 && (
                                    <span className="text-xs bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">
                                      {formatCost(session.total_cost)}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}

                          {/* Collapsed warmup sessions */}
                          {warmupSessions.length > 0 && !debouncedSearchQuery && (
                            <div className="mt-2">
                              <button
                                onClick={() => setShowWarmupSessions(!showWarmupSessions)}
                                className="w-full text-left px-3 py-2 rounded-lg bg-zinc-800/30 border border-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className={cn(
                                      "w-3 h-3 text-muted-foreground transition-transform",
                                      !showWarmupSessions && "-rotate-90"
                                    )} />
                                    <span className="text-xs text-muted-foreground">
                                      {warmupSessions.length} warmup session{warmupSessions.length !== 1 ? "s" : ""}
                                    </span>
                                    <span className="text-[10px] bg-zinc-700/50 text-zinc-400 px-1.5 py-0.5 rounded">init</span>
                                  </div>
                                </div>
                              </button>

                              {/* Expanded warmup sessions */}
                              <AnimatePresence>
                                {showWarmupSessions && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="pt-1 space-y-1 pl-4 border-l border-zinc-700/50 ml-1.5 mt-1">
                                      {warmupSessions.map((session) => (
                                        <button
                                          key={session.session_id}
                                          ref={(el) => {
                                            if (el) sessionRefs.current.set(session.session_id, el);
                                            else sessionRefs.current.delete(session.session_id);
                                          }}
                                          onClick={() => setSelectedSession(session.session_id)}
                                          className={cn(
                                            "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                                            selectedSession === session.session_id
                                              ? "bg-primary/10 text-primary"
                                              : "text-muted-foreground hover:text-foreground hover:bg-zinc-800/50"
                                          )}
                                        >
                                          {formatDateTime(session.first_message_at)}
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Empty state when only warmups exist */}
                          {filteredSessions.length === 0 && warmupSessions.length > 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                              <p className="text-sm">No conversation sessions yet</p>
                              <p className="text-xs mt-1">Only warmup sessions found</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                          <p className="text-sm font-medium">No sessions found</p>
                          <p className="text-xs mt-1">{sessionSearchQuery ? "Try a different search" : "Chat sessions will appear here"}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conversation Viewer */}
                  <div className="flex-1 flex flex-col min-w-0 rounded-lg bg-zinc-900/30 border border-zinc-800/50 overflow-hidden">
                    <ConversationViewer
                      conversation={conversation}
                      isLoading={conversationLoading}
                      sessionId={selectedSession}
                      sessionTitle={conversation?.summary || sessions?.find(s => s.session_id === selectedSession)?.first_user_message || "Session"}
                      messageCount={conversation?.messages.length || 0}
                      onCopyResumeCmd={handleCopyResumeCmd}
                      onOpenTerminalWithResume={handleOpenTerminalWithResume}
                      onExportSession={handleExportSession}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MCP Server Add/Edit Modal */}
      <AnimatePresence>
        {mcpModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={closeMcpModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl"
            >
              <h3 className="text-lg font-semibold mb-4">
                {editingMcpServer ? "Edit MCP Server" : "Add MCP Server"}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={mcpServerName}
                    onChange={(e) => setMcpServerName(e.target.value)}
                    disabled={!!editingMcpServer}
                    placeholder="my-server"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Configuration (JSON)
                  </label>
                  <textarea
                    value={mcpServerConfig}
                    onChange={(e) => setMcpServerConfig(e.target.value)}
                    placeholder='{"command": "npx", "args": ["-y", "@modelcontextprotocol/server-example"]}'
                    rows={8}
                    className={cn(
                      "w-full px-3 py-2 bg-zinc-800 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none",
                      mcpJsonError ? "border-red-500/50" : "border-zinc-700"
                    )}
                  />
                  {mcpJsonError && (
                    <p className="text-xs text-red-400 mt-1">{mcpJsonError}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={closeMcpModal}
                  className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMcpServer}
                  disabled={!mcpServerName.trim() || !!mcpJsonError || updateProjectMcpMutation.isPending}
                  className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {updateProjectMcpMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingMcpServer ? "Save Changes" : "Add Server"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MCP Server Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteMcpConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setDeleteMcpConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Remove MCP Server</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to remove <span className="text-foreground font-medium">{deleteMcpConfirm.name}</span> from this project? This will update your Claude configuration.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteMcpConfirm(null)}
                  className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveMcpServer}
                  className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                >
                  Remove Server
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonProjectCard key={i} />
            ))}
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
