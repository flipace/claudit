import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { FileText, FolderOpen, RefreshCw, Edit, Eye, Search, ExternalLink } from "lucide-react";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { PageHeader } from "../../components/PageHeader";
import { cn } from "../../lib/utils";

interface ClaudeMdFile {
  path: string;
  name: string;
  isGlobal: boolean;
  projectName?: string;
}

export function ConfigPage() {
  const [selectedFile, setSelectedFile] = useState<ClaudeMdFile | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch list of CLAUDE.md files
  const { data: files, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: ["claude-md-files"],
    queryFn: () => invoke<ClaudeMdFile[]>("list_claude_md_files"),
  });

  // Fetch content of selected file
  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["claude-md-content", selectedFile?.path],
    queryFn: () => invoke<string>("get_claude_md_content", { path: selectedFile!.path }),
    enabled: !!selectedFile,
  });

  const filteredFiles = files?.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const globalFile = filteredFiles?.find((f) => f.isGlobal);
  const projectFiles = (filteredFiles?.filter((f) => !f.isGlobal) || []).sort((a, b) => {
    // Sort by project name first, then by path for stability
    const nameA = (a.projectName || a.name).toLowerCase();
    const nameB = (b.projectName || b.name).toLowerCase();
    const nameCompare = nameA.localeCompare(nameB);
    if (nameCompare !== 0) return nameCompare;
    return a.path.localeCompare(b.path);
  });

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
        title="CLAUDE.md Configuration Files"
        description="View and manage your Claude Code configuration files. The global CLAUDE.md in ~/.claude/ applies to all projects, while project-level files override settings for specific projects."
      />
      <div className="flex-1 flex min-h-0">
        {/* File Tree Sidebar */}
        <div className="w-72 border-r border-border flex flex-col bg-zinc-900/30">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filesLoading ? (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <>
              {/* Global CLAUDE.md */}
              {globalFile && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                    Global Config
                  </div>
                  <button
                    onClick={() => setSelectedFile(globalFile)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                      selectedFile?.path === globalFile.path
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-zinc-800/50"
                    )}
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">~/.claude/CLAUDE.md</span>
                  </button>
                </div>
              )}

              {/* Project CLAUDE.md files */}
              {projectFiles.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                    Project Configs ({projectFiles.length})
                  </div>
                  {projectFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                        selectedFile?.path === file.path
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-zinc-800/50"
                      )}
                    >
                      <FolderOpen className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{file.projectName || file.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {!globalFile && projectFiles.length === 0 && (
                <div className="text-center text-muted-foreground text-sm p-4">
                  No CLAUDE.md files found
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-2 border-t border-border">
          <button
            onClick={() => refetchFiles()}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground bg-zinc-800/50 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-zinc-900/30">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{selectedFile.projectName || selectedFile.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleOpenFolder(selectedFile.path)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open Folder
                </button>
                <button
                  onClick={() => handleOpenInEditor(selectedFile.path)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </button>
                <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("preview")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors",
                    viewMode === "preview"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
                <button
                  onClick={() => setViewMode("raw")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors",
                    viewMode === "raw"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Edit className="w-3 h-3" />
                  Raw
                </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {contentLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Loading content...
                </div>
              ) : content ? (
                viewMode === "preview" ? (
                  <MarkdownViewer content={content} />
                ) : (
                  <pre className="text-sm font-mono bg-zinc-900 p-4 rounded-lg overflow-auto whitespace-pre-wrap">
                    {content}
                  </pre>
                )
              ) : (
                <div className="text-center text-muted-foreground">
                  Failed to load content
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Select a CLAUDE.md file</p>
              <p className="text-sm">Choose a file from the sidebar to view its contents</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
