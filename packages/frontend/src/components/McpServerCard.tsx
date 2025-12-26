import {
  Server,
  Edit,
  Trash2,
  Loader2,
  FolderOpen,
  ExternalLink,
} from "lucide-react";

export interface McpServer {
  name: string;
  type?: string;
  serverType?: string; // Alternative field name used in some contexts
  command?: string;
  url?: string;
  args?: string[];
  projectPath?: string;
}

interface McpServerCardProps {
  server: McpServer;
  onOpenFolder?: (path: string) => void;
  onEdit?: () => void;
  onRemove?: () => void;
  isRemoving?: boolean;
}

export function McpServerCard({
  server,
  onOpenFolder,
  onEdit,
  onRemove,
  isRemoving,
}: McpServerCardProps) {
  // Support both 'type' and 'serverType' field names
  const serverType = server.type || server.serverType || "stdio";

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
              {serverType === "stdio" ? "stdio" : "HTTP"}
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
              {isRemoving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
          {server.projectPath && onOpenFolder && (
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
        {server.url && <div className="break-all">{server.url}</div>}
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
