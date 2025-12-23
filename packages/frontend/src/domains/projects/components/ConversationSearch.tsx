import { useRef, useEffect, useCallback } from "react";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { cn } from "../../../lib/utils";

interface ConversationSearchProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
}

export function ConversationSearch({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
}: ConversationSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          onPrevMatch();
        } else {
          onNextMatch();
        }
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onNextMatch, onPrevMatch, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/80">
      <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search in conversation..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
      />
      {searchQuery && (
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : "No matches"}
        </span>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onPrevMatch}
          disabled={matchCount === 0}
          className={cn(
            "p-1 rounded hover:bg-zinc-800 transition-colors",
            matchCount === 0 ? "opacity-50 cursor-not-allowed" : ""
          )}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={onNextMatch}
          disabled={matchCount === 0}
          className={cn(
            "p-1 rounded hover:bg-zinc-800 transition-colors",
            matchCount === 0 ? "opacity-50 cursor-not-allowed" : ""
          )}
          title="Next match (Enter)"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-800 transition-colors ml-1"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
