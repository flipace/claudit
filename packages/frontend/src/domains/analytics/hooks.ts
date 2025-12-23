import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { AnalyticsStats, ChartData, AppSettings, ModelPricing, ClaudeStatus } from "../../types";

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => invoke<AnalyticsStats>("get_stats"),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useChartData(days: number = 30) {
  return useQuery({
    queryKey: ["chart-data", days],
    queryFn: () => invoke<ChartData>("get_chart_data", { days }),
  });
}

export function useRefreshStats() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => invoke<AnalyticsStats>("refresh_stats"),
    onSuccess: (data) => {
      queryClient.setQueryData(["stats"], data);
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => invoke<AppSettings>("get_settings"),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: AppSettings) =>
      invoke<void>("update_settings", { settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      // Refresh tray menu in background (don't await)
      invoke<void>("refresh_tray_menu").catch(console.error);
    },
  });
}

export function useHooksStatus() {
  return useQuery({
    queryKey: ["hooks-status"],
    queryFn: () => invoke<boolean>("check_hooks_installed"),
  });
}

export function useInstallHooks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => invoke<void>("install_hooks"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hooks-status"] });
    },
  });
}

export function useHookPort() {
  return useQuery({
    queryKey: ["hook-port"],
    queryFn: () => invoke<number>("get_hook_port"),
  });
}

export function useModelPricing() {
  return useQuery({
    queryKey: ["model-pricing"],
    queryFn: () => invoke<ModelPricing[]>("get_model_pricing"),
    staleTime: Infinity, // Pricing rarely changes
  });
}

export function useClaudeStatus() {
  return useQuery({
    queryKey: ["claude-status"],
    queryFn: () => invoke<ClaudeStatus>("get_claude_status"),
    staleTime: 60_000,
  });
}
