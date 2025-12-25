import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
  Plug,
  Server,
  RefreshCw,
  Check,
  X,
  ExternalLink,
  FolderOpen,
  Plus,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface PluginInfo {
  name: string;
  version: string;
  scope: string;
  installPath: string;
  installedAt: string;
  isLocal: boolean;
  enabled: boolean;
}

interface McpServer {
  name: string;
  type: string;
  command?: string;
  url?: string;
  args?: string[];
  projectPath?: string;
}

const DEFAULT_SERVER_CONFIG = `{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-name"]
}`;

export function PluginsPage() {
  const [activeTab, setActiveTab] = useState<"plugins" | "mcp">("plugins");
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [serverName, setServerName] = useState("");
  const [serverConfig, setServerConfig] = useState(DEFAULT_SERVER_CONFIG);
  const [removingServerName, setRemovingServerName] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch installed plugins
  const {
    data: plugins,
    isLoading: pluginsLoading,
    refetch: refetchPlugins,
  } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => invoke<PluginInfo[]>("get_installed_plugins"),
  });

  // Fetch MCP servers
  const {
    data: mcpServers,
    isLoading: mcpLoading,
    refetch: refetchMcp,
  } = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: () => invoke<McpServer[]>("get_mcp_servers"),
  });

  // Add MCP server mutation
  const addServerMutation = useMutation({
    mutationFn: ({ name, configJson }: { name: string; configJson: string }) =>
      invoke("add_mcp_server", { name, configJson }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
      closeServerModal();
    },
  });

  // Update MCP server mutation
  const updateServerMutation = useMutation({
    mutationFn: ({ name, configJson }: { name: string; configJson: string }) =>
      invoke("update_mcp_server", { name, configJson }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
      closeServerModal();
    },
  });

  // Remove MCP server mutation
  const removeServerMutation = useMutation({
    mutationFn: (name: string) => invoke("remove_mcp_server", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
      setRemovingServerName(null);
    },
    onError: () => {
      setRemovingServerName(null);
    },
  });

  const handleRemoveServer = (name: string) => {
    setRemovingServerName(name);
    removeServerMutation.mutate(name);
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && serverModalOpen) {
        closeServerModal();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [serverModalOpen]);

  const closeServerModal = () => {
    setServerModalOpen(false);
    setEditingServer(null);
    setServerName("");
    setServerConfig(DEFAULT_SERVER_CONFIG);
  };

  const openAddModal = () => {
    setEditingServer(null);
    setServerName("");
    setServerConfig(DEFAULT_SERVER_CONFIG);
    setServerModalOpen(true);
  };

  const openEditModal = (server: McpServer) => {
    setEditingServer(server);
    setServerName(server.name);
    // Build config JSON from all known server properties (excluding metadata)
    const { name: _, type: __, projectPath: ___, ...configFields } = server;
    // Filter out undefined values
    const config = Object.fromEntries(
      Object.entries(configFields).filter(([, v]) => v !== undefined)
    );
    setServerConfig(JSON.stringify(config, null, 2));
    setServerModalOpen(true);
  };

  const globalMcpServers = mcpServers?.filter((s) => !s.projectPath) || [];
  const projectMcpServers = mcpServers?.filter((s) => s.projectPath) || [];

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke("open_folder", { path });
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  };

  const handleOpenConfigFile = async () => {
    try {
      const path = await invoke<string>("get_mcp_config_path");
      await invoke("open_in_editor", { path });
    } catch (e) {
      console.error("Failed to open config file:", e);
    }
  };

  const validateJson = (json: string): string | null => {
    try {
      JSON.parse(json);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  };

  const jsonError = serverConfig ? validateJson(serverConfig) : null;

  const handleSaveServer = () => {
    if (!serverName.trim() || jsonError) return;
    if (editingServer) {
      updateServerMutation.mutate({ name: serverName, configJson: serverConfig });
    } else {
      addServerMutation.mutate({ name: serverName, configJson: serverConfig });
    }
  };

  const isModalLoading = addServerMutation.isPending || updateServerMutation.isPending;
  const modalError = addServerMutation.error || updateServerMutation.error;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Plugins & MCP Servers"
        description="Plugins extend Claude Code with new capabilities. MCP (Model Context Protocol) servers provide tools and context to Claude. Configure them in ~/.claude.json or per-project."
      />
      {/* Tabs Header */}
      <div className="px-4 py-3 border-b border-border bg-zinc-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("plugins")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                activeTab === "plugins"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Plug className="w-4 h-4" />
              Plugins
              {plugins && (
                <span className="text-xs opacity-70">({plugins.length})</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("mcp")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                activeTab === "mcp"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Server className="w-4 h-4" />
              MCP Servers
              {mcpServers && (
                <span className="text-xs opacity-70">({mcpServers.length})</span>
              )}
            </button>
          </div>
          <button
            onClick={() =>
              activeTab === "plugins" ? refetchPlugins() : refetchMcp()
            }
            className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "plugins" ? (
          pluginsLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading plugins...
            </div>
          ) : plugins && plugins.length > 0 ? (
            <div className="grid gap-3">
              {plugins.map((plugin) => (
                <div
                  key={plugin.name}
                  className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          plugin.enabled ? "bg-emerald-500/10" : "bg-zinc-800"
                        )}
                      >
                        <Plug
                          className={cn(
                            "w-5 h-5",
                            plugin.enabled
                              ? "text-emerald-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <div className="font-medium">{plugin.name}</div>
                        <div className="text-xs text-muted-foreground">
                          v{plugin.version} • {plugin.scope}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plugin.enabled ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-500">
                          <Check className="w-3 h-3" />
                          Enabled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <X className="w-3 h-3" />
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      <div className="truncate">{plugin.installPath}</div>
                      <div className="mt-1">
                        Installed: {new Date(plugin.installedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenFolder(plugin.installPath)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Plug className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No plugins installed</p>
              <p className="text-sm">
                Install plugins via Claude Code to see them here
              </p>
            </div>
          )
        ) : mcpLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading MCP servers...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Server
              </button>
              <button
                onClick={handleOpenConfigFile}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Config
              </button>
            </div>

            {mcpServers && mcpServers.length > 0 ? (
              <>
                {/* Global MCP Servers */}
                {globalMcpServers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Global Servers
                    </h3>
                    <div className="grid gap-3">
                      {globalMcpServers.map((server) => (
                        <McpServerCard
                          key={server.name}
                          server={server}
                          onOpenFolder={handleOpenFolder}
                          onEdit={() => openEditModal(server)}
                          onRemove={() => handleRemoveServer(server.name)}
                          isRemoving={removingServerName === server.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Project MCP Servers */}
                {projectMcpServers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Project Servers
                    </h3>
                    <div className="grid gap-3">
                      {projectMcpServers.map((server) => (
                        <McpServerCard
                          key={`${server.projectPath}-${server.name}`}
                          server={server}
                          onOpenFolder={handleOpenFolder}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">No MCP servers configured</p>
                <p className="text-sm">
                  Click "Add Server" to configure your first MCP server
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Server Modal */}
      <AnimatePresence>
        {serverModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={closeServerModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden m-4"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-500" />
                  <h3 className="font-medium">{editingServer ? "Edit MCP Server" : "Add MCP Server"}</h3>
                </div>
                <button
                  onClick={closeServerModal}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Server Name</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="my-mcp-server"
                    disabled={!!editingServer}
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {editingServer && (
                    <p className="text-xs text-muted-foreground mt-1">Server name cannot be changed</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Server Config (JSON)</label>
                  <textarea
                    value={serverConfig}
                    onChange={(e) => setServerConfig(e.target.value)}
                    rows={8}
                    className={cn(
                      "w-full px-3 py-2 text-sm font-mono bg-zinc-800/50 border rounded-md focus:outline-none focus:ring-1 resize-none",
                      jsonError
                        ? "border-red-500/50 focus:ring-red-500"
                        : "border-zinc-700/50 focus:ring-primary"
                    )}
                  />
                  {jsonError ? (
                    <p className="text-xs text-red-400 mt-1.5">{jsonError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Server configuration JSON. Common fields: command, args, url, env
                    </p>
                  )}
                </div>

                {modalError && (
                  <div className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-md">
                    {modalError instanceof Error
                      ? modalError.message
                      : "Failed to save server"}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
                <button
                  onClick={closeServerModal}
                  className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveServer}
                  disabled={!serverName.trim() || !!jsonError || isModalLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isModalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingServer ? "Save Changes" : "Add Server"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface McpServerCardProps {
  server: McpServer;
  onOpenFolder: (path: string) => void;
  onEdit?: () => void;
  onRemove?: () => void;
  isRemoving?: boolean;
}

function McpServerCard({ server, onOpenFolder, onEdit, onRemove, isRemoving }: McpServerCardProps) {
  return (
    <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{server.name}</div>
            <div className="text-xs text-muted-foreground">
              {server.type === "stdio" ? "stdio" : "HTTP"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800/50 transition-colors"
              title="Edit Server"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              disabled={isRemoving}
              className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-red-400/10 transition-colors disabled:opacity-50"
              title="Remove Server"
            >
              {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          {server.projectPath && (
            <button
              onClick={() => onOpenFolder(server.projectPath!)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800/50 transition-colors"
              title="Open Project Folder"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
          {server.url && (
            <a
              href={server.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-zinc-800/50 transition-colors"
              title="Open URL"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {server.command && (
          <div className="font-mono bg-zinc-800/50 px-2 py-1.5 rounded break-all whitespace-pre-wrap">
            {server.command} {server.args?.join(" ")}
          </div>
        )}
        {server.url && (
          <div className="break-all">{server.url}</div>
        )}
        {server.projectPath && (
          <div className="flex items-center gap-1 mt-2 min-w-0">
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span className="break-all">{server.projectPath}</span>
          </div>
        )}
      </div>
    </div>
  );
}
