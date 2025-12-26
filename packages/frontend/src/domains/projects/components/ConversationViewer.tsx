import { useState, useMemo, useEffect, useRef, useCallback, ReactNode } from "react";
import {
  MessageSquare,
  Copy,
  Check,
  Play,
  Download,
  ChevronRight,
  ChevronDown,
  User,
  Bot,
  Wrench,
  Brain,
  Loader2,
  Search,
  Clipboard,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { MarkdownViewer } from "../../../components/MarkdownViewer";
import { ConversationSearch } from "./ConversationSearch";
import type { SessionConversation, ConversationMessage, MessageContentBlock } from "../../../types";

interface ConversationViewerProps {
  conversation: SessionConversation | undefined;
  isLoading: boolean;
  sessionId: string | null;
  sessionTitle: string;
  messageCount: number;
  onCopyResumeCmd: (sessionId: string) => void;
  onOpenTerminalWithResume: (sessionId: string) => void;
  onExportSession: (sessionId: string) => void;
}

// Helper to format date/time
function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConversationViewer({
  conversation,
  isLoading,
  sessionId,
  sessionTitle,
  messageCount,
  onCopyResumeCmd,
  onOpenTerminalWithResume,
  onExportSession,
}: ConversationViewerProps) {
  const [copiedResumeCmd, setCopiedResumeCmd] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  // In-conversation search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const matchRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Reset search when session changes
  useEffect(() => {
    setShowSearch(false);
    setSearchQuery("");
    setCurrentMatchIndex(0);
    setExpandedTools(new Set());
    matchRefs.current.clear();
  }, [sessionId]);

  // Find all text matches in conversation
  const matches = useMemo(() => {
    if (!conversation?.messages || !searchQuery.trim()) return [];

    const searchLower = searchQuery.toLowerCase();
    const found: { messageIndex: number; blockIndex: number }[] = [];

    conversation.messages.forEach((msg, msgIdx) => {
      msg.content.forEach((block, blockIdx) => {
        if (block.type === "text" && block.text.toLowerCase().includes(searchLower)) {
          found.push({ messageIndex: msgIdx, blockIndex: blockIdx });
        }
        if (block.type === "thinking" && block.thinking.toLowerCase().includes(searchLower)) {
          found.push({ messageIndex: msgIdx, blockIndex: blockIdx });
        }
      });
    });

    return found;
  }, [conversation?.messages, searchQuery]);

  // Reset match index when search changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  // Scroll to current match
  useEffect(() => {
    if (matches.length > 0 && matchRefs.current.has(currentMatchIndex)) {
      const element = matchRefs.current.get(currentMatchIndex);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentMatchIndex, matches.length]);

  // Navigate matches
  const goToNextMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  }, [matches.length]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  }, [matches.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && sessionId) {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessionId]);

  const toggleToolExpanded = (toolId: string) => {
    setExpandedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };

  const handleCopyResumeCmd = async () => {
    if (!sessionId) return;
    onCopyResumeCmd(sessionId);
    setCopiedResumeCmd(true);
    setTimeout(() => setCopiedResumeCmd(false), 2000);
  };

  // Check if a specific message/block is the current match
  const isCurrentMatch = (msgIdx: number, blockIdx: number) => {
    if (matches.length === 0) return false;
    const match = matches[currentMatchIndex];
    return match?.messageIndex === msgIdx && match?.blockIndex === blockIdx;
  };

  // Highlight search matches in text
  const highlightMatches = (text: string, isActive: boolean): ReactNode => {
    if (!searchQuery.trim()) return text;

    const searchLower = searchQuery.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(searchLower);

    if (index === -1) return text;

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let currentIdx = index;
    let matchNum = 0;

    while (currentIdx !== -1) {
      if (currentIdx > lastIndex) {
        parts.push(text.slice(lastIndex, currentIdx));
      }

      const matchedText = text.slice(currentIdx, currentIdx + searchQuery.length);
      parts.push(
        <mark
          key={`match-${matchNum}`}
          className={cn(
            "px-0.5 rounded",
            isActive ? "bg-amber-500 text-black" : "bg-amber-500/30 text-foreground"
          )}
        >
          {matchedText}
        </mark>
      );

      lastIndex = currentIdx + searchQuery.length;
      currentIdx = textLower.indexOf(searchLower, lastIndex);
      matchNum++;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return <>{parts}</>;
  };

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Select a session</p>
          <p className="text-xs mt-1">Choose a session from the list to view the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Session Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800/50 bg-zinc-900/50 flex-shrink-0">
        <div className="flex-1 min-w-0 overflow-hidden mr-2">
          <p className="text-sm font-medium truncate">{sessionTitle}</p>
          <p className="text-xs text-muted-foreground">{messageCount} messages</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowSearch((prev) => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors",
              showSearch ? "bg-primary/20 text-primary" : "bg-zinc-800 hover:bg-zinc-700"
            )}
            title="Search in conversation (Cmd+F)"
          >
            <Search className="w-3 h-3" />
          </button>
          <button
            onClick={handleCopyResumeCmd}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            title="Copy resume command"
          >
            {copiedResumeCmd ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy Resume
              </>
            )}
          </button>
          <button
            onClick={() => onOpenTerminalWithResume(sessionId)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            title="Open terminal with resume"
          >
            <Play className="w-3 h-3" />
            Resume
          </button>
          <button
            onClick={() => onExportSession(sessionId)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            title="Export to HTML"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <ConversationSearch
        isOpen={showSearch}
        onClose={() => {
          setShowSearch(false);
          setSearchQuery("");
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        matchCount={matches.length}
        currentMatchIndex={currentMatchIndex}
        onNextMatch={goToNextMatch}
        onPrevMatch={goToPrevMatch}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading conversation...
          </div>
        ) : (
          conversation?.messages.map((msg, msgIdx) => (
            <MessageBubble
              key={msg.uuid}
              message={msg}
              msgIdx={msgIdx}
              expandedTools={expandedTools}
              onToggleTool={toggleToolExpanded}
              searchQuery={searchQuery}
              isCurrentMatch={isCurrentMatch}
              highlightMatches={highlightMatches}
              matchRefs={matchRefs}
              matches={matches}
            />
          ))
        )}
      </div>
    </>
  );
}

// Separate component for message bubble
interface MessageBubbleProps {
  message: ConversationMessage;
  msgIdx: number;
  expandedTools: Set<string>;
  onToggleTool: (toolId: string) => void;
  searchQuery: string;
  isCurrentMatch: (msgIdx: number, blockIdx: number) => boolean;
  highlightMatches: (text: string, isActive: boolean) => ReactNode;
  matchRefs: React.MutableRefObject<Map<number, HTMLElement>>;
  matches: { messageIndex: number; blockIndex: number }[];
}

function MessageBubble({
  message,
  msgIdx,
  expandedTools,
  onToggleTool,
  searchQuery,
  isCurrentMatch,
  highlightMatches,
  matchRefs,
  matches,
}: MessageBubbleProps) {
  // Get the match index for a specific block (for ref assignment)
  const getMatchRefIndex = (blockIdx: number): number | null => {
    const idx = matches.findIndex(
      (m) => m.messageIndex === msgIdx && m.blockIndex === blockIdx
    );
    return idx >= 0 ? idx : null;
  };

  return (
    <div
      className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "")}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          message.role === "user" ? "bg-primary/10" : "bg-purple-500/10"
        )}
      >
        {message.role === "user" ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Bot className="w-4 h-4 text-purple-500" />
        )}
      </div>
      <div
        className={cn(
          "flex-1 min-w-0 max-w-[85%] overflow-hidden",
          message.role === "user" ? "text-right" : ""
        )}
      >
        {message.content.map((block, blockIdx) => {
          const toolId = `${message.uuid}-${blockIdx}`;
          const isExpanded = expandedTools.has(toolId);
          const isMatch = isCurrentMatch(msgIdx, blockIdx);
          const matchRefIdx = getMatchRefIndex(blockIdx);

          return (
            <ContentBlock
              key={blockIdx}
              block={block}
              isExpanded={isExpanded}
              onToggle={() => onToggleTool(toolId)}
              role={message.role}
              searchQuery={searchQuery}
              isMatch={isMatch}
              highlightMatches={highlightMatches}
              refCallback={
                matchRefIdx !== null
                  ? (el: HTMLElement | null) => {
                      if (el) {
                        matchRefs.current.set(matchRefIdx, el);
                      } else {
                        matchRefs.current.delete(matchRefIdx);
                      }
                    }
                  : undefined
              }
            />
          );
        })}
        {message.timestamp && (
          <p className="text-xs text-muted-foreground mt-1">
            {formatDateTime(message.timestamp)}
            {message.model && ` • ${message.model.split("-").slice(0, 2).join("-")}`}
          </p>
        )}
      </div>
    </div>
  );
}

// Separate component for content blocks
interface ContentBlockProps {
  block: MessageContentBlock;
  isExpanded: boolean;
  onToggle: () => void;
  role: "user" | "assistant";
  searchQuery: string;
  isMatch: boolean;
  highlightMatches: (text: string, isActive: boolean) => ReactNode;
  refCallback?: (el: HTMLElement | null) => void;
}

function ContentBlock({
  block,
  isExpanded,
  onToggle,
  role,
  searchQuery,
  isMatch,
  highlightMatches,
  refCallback,
}: ContentBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  if (block.type === "text") {
    // Skip empty text blocks
    if (!block.text || !block.text.trim()) return null;

    const hasMatch = searchQuery && block.text.toLowerCase().includes(searchQuery.toLowerCase());
    return (
      <div
        ref={refCallback}
        className={cn(
          "mb-2 text-sm p-3 rounded-lg overflow-hidden break-words relative group",
          role === "user" ? "bg-primary/10 text-left" : "bg-zinc-800/50",
          hasMatch && isMatch && "ring-2 ring-amber-500"
        )}
      >
        <button
          onClick={() => handleCopy(block.text)}
          className="absolute top-2 right-2 p-1.5 rounded bg-zinc-700/80 hover:bg-zinc-600 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Clipboard className="w-3.5 h-3.5" />
          )}
        </button>
        {searchQuery && hasMatch ? (
          <div className="whitespace-pre-wrap">{highlightMatches(block.text, isMatch)}</div>
        ) : (
          <MarkdownViewer content={block.text} />
        )}
      </div>
    );
  }

  if (block.type === "thinking") {
    // Skip empty thinking blocks
    if (!block.thinking || !block.thinking.trim()) return null;

    const hasMatch = searchQuery && block.thinking.toLowerCase().includes(searchQuery.toLowerCase());
    // When collapsed, show a simple truncated preview without preserving whitespace
    const previewText = block.thinking.replace(/\n+/g, ' ').slice(0, 200);

    return (
      <button
        ref={refCallback as React.Ref<HTMLButtonElement>}
        onClick={onToggle}
        className={cn(
          "mb-2 w-full text-left text-xs p-2 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors",
          hasMatch && isMatch && "ring-2 ring-amber-500"
        )}
      >
        <div className="flex items-center gap-1 mb-1 font-medium">
          <Brain className="w-3 h-3" />
          Thinking
          <ChevronDown
            className={cn("w-3 h-3 ml-auto transition-transform", isExpanded && "rotate-180")}
          />
        </div>
        {isExpanded ? (
          <p className="text-foreground/70 text-left whitespace-pre-wrap break-words overflow-hidden">
            {searchQuery && hasMatch ? highlightMatches(block.thinking, isMatch) : block.thinking}
          </p>
        ) : (
          <p className="text-foreground/70 text-left truncate">
            {searchQuery && hasMatch ? highlightMatches(previewText, isMatch) : previewText}
            {block.thinking.length > 200 && "..."}
          </p>
        )}
      </button>
    );
  }

  if (block.type === "tool_use") {
    return (
      <button
        onClick={onToggle}
        className="mb-2 w-full text-left text-xs p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
      >
        <div className="flex items-center gap-1">
          <Wrench className="w-3 h-3" />
          <span className="font-medium">{block.name || "Tool"}</span>
          <ChevronDown
            className={cn("w-3 h-3 ml-auto transition-transform", isExpanded && "rotate-180")}
          />
        </div>
        {isExpanded && block.input !== undefined && (
          <pre className="mt-2 p-2 bg-zinc-900/50 rounded text-foreground/70 overflow-x-auto text-[10px] whitespace-pre-wrap break-words">
            {typeof block.input === "string"
              ? block.input
              : JSON.stringify(block.input as Record<string, unknown>, null, 2)}
          </pre>
        )}
      </button>
    );
  }

  if (block.type === "tool_result") {
    return (
      <button
        onClick={onToggle}
        className="mb-2 w-full text-left text-xs p-2 rounded-lg bg-zinc-800/50 text-muted-foreground hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-1">
          <ChevronRight
            className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-90")}
          />
          Tool result
          <ChevronDown
            className={cn("w-3 h-3 ml-auto transition-transform", isExpanded && "rotate-180")}
          />
        </div>
        {isExpanded && block.content !== undefined && (
          <pre className="mt-2 p-2 bg-zinc-900/50 rounded text-foreground/70 overflow-x-auto text-[10px] whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
            {typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content as Record<string, unknown>, null, 2)}
          </pre>
        )}
      </button>
    );
  }

  return null;
}
