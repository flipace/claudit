import {
  Terminal,
  Edit,
  FolderOpen,
  ChevronDown,
  Loader2,
  FileText,
  File,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export interface CommandInfo {
  name: string;
  path: string;
  description?: string;
  isDirectory?: boolean;
}

export interface DirectoryFile {
  name: string;
  path: string;
  isMarkdown: boolean;
}

interface CommandCardProps {
  command: CommandInfo;
  isExpanded?: boolean;
  isLoadingContent?: boolean;
  content?: string;
  // Directory support
  directoryFiles?: DirectoryFile[];
  selectedFilePath?: string;
  onSelectFile?: (path: string) => void;
  isLoadingFiles?: boolean;
  // Actions
  onToggleExpand?: () => void;
  onOpenFolder?: (path: string) => void;
  onEdit?: (path: string) => void;
  renderContent?: (content: string) => React.ReactNode;
}

export function CommandCard({
  command,
  isExpanded,
  isLoadingContent,
  content,
  directoryFiles,
  selectedFilePath,
  onSelectFile,
  isLoadingFiles,
  onToggleExpand,
  onOpenFolder,
  onEdit,
  renderContent,
}: CommandCardProps) {
  const isDirectory = command.isDirectory;
  const hasFiles = directoryFiles && directoryFiles.length > 0;

  return (
    <div className="rounded-lg bg-zinc-900/50 border border-zinc-800/50 overflow-hidden">
      {/* Command Header - Clickable to expand */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5 text-emerald-500" />
            {isDirectory && (
              <FolderOpen className="w-3 h-3 text-amber-500 absolute -bottom-0.5 -right-0.5" />
            )}
          </div>
          <div className="text-left min-w-0">
            <div className="font-medium truncate">/{command.name}</div>
            {command.description ? (
              <div className="text-xs text-muted-foreground line-clamp-1">{command.description}</div>
            ) : (
              <div className="text-xs text-muted-foreground">
                {isDirectory ? "Directory" : "Click to view content"}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onOpenFolder && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenFolder(command.path); }}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
              title="Open folder"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // For directories, edit the selected file; for files, edit the command
                onEdit(isDirectory && selectedFilePath ? selectedFilePath : command.path);
              }}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
              title="Edit file"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onToggleExpand && (
            <ChevronDown
              className={cn(
                "w-5 h-5 text-muted-foreground transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* File Tabs for Directories */}
            {isDirectory && hasFiles && (
              <div className="flex gap-1 px-4 py-2 border-t border-zinc-800/50 bg-zinc-950/50 overflow-x-auto">
                {directoryFiles.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => onSelectFile?.(file.path)}
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

            {/* Content */}
            <div className={cn(
              "px-4 pb-4",
              !isDirectory || !hasFiles ? "border-t border-zinc-800/50" : ""
            )}>
              {isLoadingFiles ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading files...
                </div>
              ) : isLoadingContent ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : content ? (
                <div className="pt-4">
                  {renderContent ? renderContent(content) : (
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                      {content}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  {isDirectory && !hasFiles ? "No files in directory" : "Failed to load content"}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
