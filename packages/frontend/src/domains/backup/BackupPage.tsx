import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Download,
  Upload,
  RefreshCw,
  Check,
  AlertCircle,
  FileArchive,
  FolderOpen,
  FileText,
  Bot,
  Terminal,
  Plug,
  Settings,
  GitBranch,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { cn } from "../../lib/utils";

interface ExportOptions {
  includeGlobalClaude: boolean;
  includeProjectClaude: boolean;
  includeAgents: boolean;
  includeCommands: boolean;
  includeSettings: boolean;
  includePluginConfig: boolean;
}

interface BackupInfo {
  path: string;
  size: number;
  createdAt: string;
}

interface GitStatus {
  isGitRepo: boolean;
  hasChanges: boolean;
  branch: string;
  uncommittedFiles: string[];
}

export function BackupPage() {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeGlobalClaude: true,
    includeProjectClaude: true,
    includeAgents: true,
    includeCommands: true,
    includeSettings: true,
    includePluginConfig: true,
  });

  // Check git status of ~/.claude
  const { data: gitStatus, isLoading: gitLoading } = useQuery({
    queryKey: ["config-git-status"],
    queryFn: () => invoke<GitStatus>("get_config_git_status"),
  });

  // Export config
  const exportMutation = useMutation({
    mutationFn: async () => {
      const savePath = await save({
        defaultPath: `claude-config-backup-${new Date().toISOString().split("T")[0]}.zip`,
        filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
      });
      if (!savePath) throw new Error("No save path selected");
      return invoke<BackupInfo>("export_config", {
        options: exportOptions,
        outputPath: savePath,
      });
    },
  });

  // Import config
  const importMutation = useMutation({
    mutationFn: async () => {
      const filePath = await open({
        filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
        multiple: false,
      });
      if (!filePath) throw new Error("No file selected");
      return invoke<void>("import_config", { zipPath: filePath });
    },
  });

  const toggleOption = (key: keyof ExportOptions) => {
    setExportOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const exportItems = [
    {
      key: "includeGlobalClaude" as const,
      label: "Global CLAUDE.md",
      description: "~/.claude/CLAUDE.md",
      icon: <FileText className="w-4 h-4 text-primary" />,
    },
    {
      key: "includeProjectClaude" as const,
      label: "Project CLAUDE.md files",
      description: "All project-level config files",
      icon: <FolderOpen className="w-4 h-4 text-amber-500" />,
    },
    {
      key: "includeAgents" as const,
      label: "Custom Agents",
      description: "~/.claude/agents/",
      icon: <Bot className="w-4 h-4 text-primary" />,
    },
    {
      key: "includeCommands" as const,
      label: "Slash Commands",
      description: "~/.claude/commands/",
      icon: <Terminal className="w-4 h-4 text-emerald-500" />,
    },
    {
      key: "includeSettings" as const,
      label: "Settings",
      description: "settings.json, hooks, status line",
      icon: <Settings className="w-4 h-4 text-muted-foreground" />,
    },
    {
      key: "includePluginConfig" as const,
      label: "Plugin Configuration",
      description: "Installed plugins list (not plugin files)",
      icon: <Plug className="w-4 h-4 text-blue-500" />,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Backup & Export"
        description="Create backups of your Claude Code configuration to restore later or share across machines. Export includes agents, commands, CLAUDE.md files, and settings."
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Git Status */}
          {gitLoading ? (
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking git status...
              </div>
            </div>
          ) : gitStatus?.isGitRepo ? (
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-4 h-4 text-emerald-500" />
                <span className="font-medium">Git Repository Detected</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Branch: {gitStatus.branch}</p>
                {gitStatus.hasChanges && (
                  <p className="text-amber-500 mt-1">
                    {gitStatus.uncommittedFiles.length} uncommitted changes
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* Export Section */}
          <div className="p-6 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileArchive className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Export Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Create a backup of your Claude Code configuration
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {exportItems.map((item) => (
                <label
                  key={item.key}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                    exportOptions[item.key]
                      ? "bg-primary/5 border border-primary/20"
                      : "bg-zinc-800/30 border border-transparent hover:bg-zinc-800/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={exportOptions[item.key]}
                    onChange={() => toggleOption(item.key)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center",
                      exportOptions[item.key]
                        ? "bg-primary border-primary"
                        : "border-zinc-600"
                    )}
                  >
                    {exportOptions[item.key] && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                  {item.icon}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={() => exportMutation.mutate()}
              disabled={
                exportMutation.isPending ||
                !Object.values(exportOptions).some(Boolean)
              }
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                exportMutation.isPending ||
                  !Object.values(exportOptions).some(Boolean)
                  ? "bg-zinc-700 cursor-not-allowed text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {exportMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export to ZIP
                </>
              )}
            </button>

            {exportMutation.isSuccess && exportMutation.data && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-500 text-sm">
                  <Check className="w-4 h-4" />
                  <span>
                    Exported successfully ({formatSize(exportMutation.data.size)})
                  </span>
                </div>
              </div>
            )}

            {exportMutation.isError && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Export failed. Please try again.</span>
                </div>
              </div>
            )}
          </div>

          {/* Import Section */}
          <div className="p-6 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Import Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Restore configuration from a backup file
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/20 mb-4">
              <div className="text-center text-muted-foreground">
                <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a ZIP backup file to import</p>
                <p className="text-xs mt-1">
                  Existing files will be backed up before overwriting
                </p>
              </div>
            </div>

            <button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                importMutation.isPending
                  ? "bg-zinc-700 cursor-not-allowed text-muted-foreground"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              )}
            >
              {importMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Select & Import
                </>
              )}
            </button>

            {importMutation.isSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-500 text-sm">
                  <Check className="w-4 h-4" />
                  <span>Configuration imported successfully!</span>
                </div>
              </div>
            )}

            {importMutation.isError && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Import failed. Please check the file and try again.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
