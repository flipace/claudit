import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  RefreshCw,
  Sparkles,
  BarChart2,
  Lightbulb,
  Terminal,
  Bot,
  Zap,
  Play,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { cn } from "../../lib/utils";
import { MarkdownViewer } from "../../components/MarkdownViewer";

interface PatternAnalysis {
  mostUsedTools: { name: string; count: number }[];
  commonPromptPatterns: { pattern: string; count: number }[];
  tokenEfficiency: {
    averageInputTokens: number;
    averageOutputTokens: number;
    ratio: number;
  };
  sessionStats: {
    totalSessions: number;
    averageDuration: number;
    totalCost: number;
  };
}

interface AiSuggestion {
  type: "agent" | "command" | "optimization";
  title: string;
  description: string;
  content?: string;
}

export function AnalysisPage() {
  const [selectedDays, setSelectedDays] = useState(30);
  const [activeTab, setActiveTab] = useState<"patterns" | "suggestions">(
    "patterns"
  );

  // Fetch pattern analysis
  const {
    data: patterns,
    isLoading: patternsLoading,
    refetch: refetchPatterns,
  } = useQuery({
    queryKey: ["chat-patterns", selectedDays],
    queryFn: () => invoke<PatternAnalysis>("analyze_chat_patterns", { days: selectedDays }),
  });

  // Get AI suggestions via Claude CLI
  const suggestMutation = useMutation({
    mutationFn: () => invoke<AiSuggestion[]>("get_ai_suggestions", { days: selectedDays }),
  });

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Chat Analysis"
        description="Analyze your Claude Code usage patterns to discover insights. Find your most-used tools, common prompts, and get AI-powered suggestions for custom agents and optimizations."
      />
      {/* Controls */}
      <div className="px-4 py-3 border-b border-border bg-zinc-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            <span className="font-medium">Analysis Period</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedDays}
              onChange={(e) => setSelectedDays(Number(e.target.value))}
              className="text-xs bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
            <button
              onClick={() => refetchPatterns()}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-zinc-800/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("patterns")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "patterns"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart2 className="w-4 h-4" />
            Patterns
          </button>
          <button
            onClick={() => setActiveTab("suggestions")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeTab === "suggestions"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="w-4 h-4" />
            AI Suggestions
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "patterns" ? (
          patternsLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Analyzing chat patterns...
            </div>
          ) : patterns ? (
            <div className="space-y-6">
              {/* Session Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <div className="text-xs text-muted-foreground mb-1">
                    Total Sessions
                  </div>
                  <div className="text-2xl font-bold">
                    {patterns.sessionStats.totalSessions}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <div className="text-xs text-muted-foreground mb-1">
                    Total Cost
                  </div>
                  <div className="text-2xl font-bold text-emerald-500">
                    ${patterns.sessionStats.totalCost.toFixed(2)}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <div className="text-xs text-muted-foreground mb-1">
                    Avg. Duration
                  </div>
                  <div className="text-2xl font-bold">
                    {Math.round(patterns.sessionStats.averageDuration / 60000)}m
                  </div>
                </div>
              </div>

              {/* Token Efficiency */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Token Efficiency
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Avg. Input Tokens
                    </div>
                    <div className="text-lg font-medium">
                      {Math.round(patterns.tokenEfficiency.averageInputTokens).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Avg. Output Tokens
                    </div>
                    <div className="text-lg font-medium">
                      {Math.round(patterns.tokenEfficiency.averageOutputTokens).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Input/Output Ratio
                    </div>
                    <div className="text-lg font-medium">
                      {patterns.tokenEfficiency.ratio.toFixed(2)}x
                    </div>
                  </div>
                </div>
              </div>

              {/* Most Used Tools */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-500" />
                  Most Used Tools
                </h3>
                {patterns.mostUsedTools.length > 0 ? (
                  <div className="space-y-2">
                    {patterns.mostUsedTools.slice(0, 10).map((tool, i) => (
                      <div key={tool.name} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-mono">{tool.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {tool.count}
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${(tool.count / patterns.mostUsedTools[0].count) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tool usage data</p>
                )}
              </div>

              {/* Common Prompt Patterns */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Common Prompt Patterns
                </h3>
                {patterns.commonPromptPatterns.length > 0 ? (
                  <div className="space-y-2">
                    {patterns.commonPromptPatterns.slice(0, 5).map((pattern, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-2 rounded-md bg-zinc-800/30"
                      >
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {pattern.count}x
                        </span>
                        <span className="text-sm">{pattern.pattern}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No prompt patterns detected yet
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No analysis data</p>
              <p className="text-sm">Use Claude Code to generate analysis data</p>
            </div>
          )
        ) : (
          // AI Suggestions Tab
          <div className="space-y-6">
            {/* Generate Suggestions Button */}
            <div className="p-6 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">AI-Powered Suggestions</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Analyze your chat patterns and get personalized suggestions for new
                    agents, commands, and optimizations. Uses Claude CLI in the background.
                  </p>
                  <button
                    onClick={() => suggestMutation.mutate()}
                    disabled={suggestMutation.isPending}
                    className={cn(
                      "mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      suggestMutation.isPending
                        ? "bg-primary/50 cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {suggestMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing with Claude...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Generate Suggestions
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Error State */}
            {suggestMutation.isError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Failed to generate suggestions. Make sure Claude CLI is installed.
                  </span>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestMutation.data && suggestMutation.data.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-muted-foreground">Suggestions</h3>
                {suggestMutation.data.map((suggestion, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
                  >
                    <div className="flex items-start gap-3">
                      {suggestion.type === "agent" ? (
                        <Bot className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      ) : suggestion.type === "command" ? (
                        <Terminal className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{suggestion.title}</span>
                          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-zinc-800 rounded">
                            {suggestion.type}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {suggestion.description}
                        </p>
                        {suggestion.content && (
                          <div className="mt-3">
                            <MarkdownViewer content={suggestion.content} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!suggestMutation.isPending &&
              !suggestMutation.data &&
              !suggestMutation.isError && (
                <div className="text-center text-muted-foreground py-8">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">No suggestions yet</p>
                  <p className="text-sm">
                    Click "Generate Suggestions" to analyze your patterns
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
