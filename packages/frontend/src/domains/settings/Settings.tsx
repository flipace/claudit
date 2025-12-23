import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings, useUpdateSettings, useHooksStatus, useInstallHooks, useHookPort, useModelPricing } from "../analytics/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppSettings } from "../../types";
import {
  Bell,
  Check,
  Settings as SettingsIcon,
  Webhook,
  Eye,
  Zap,
  AlertCircle,
  Terminal,
  FolderOpen,
  DollarSign,
} from "lucide-react";

function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? "bg-primary" : "bg-secondary"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border px-4">
        {children}
      </div>
    </div>
  );
}

export function Settings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useSettings();
  const updateSettingsMutation = useUpdateSettings();
  const { data: hooksInstalled } = useHooksStatus();
  const { data: hookPort } = useHookPort();
  const installHooksMutation = useInstallHooks();
  const { data: pricing } = useModelPricing();
  const [uninstalling, setUninstalling] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<boolean | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Check notification permission on mount
  useEffect(() => {
    isPermissionGranted().then(setNotificationPermission);
  }, []);

  // Listen for settings changes from tray menu
  useEffect(() => {
    const unlisten = listen<AppSettings>("settings-changed", (event) => {
      // Update query cache directly with new settings
      queryClient.setQueryData(["settings"], event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  const handleRequestPermission = async () => {
    setRequestingPermission(true);
    try {
      const permission = await requestPermission();
      setNotificationPermission(permission === "granted");
      if (permission === "granted") {
        // Send a test notification
        sendNotification({ title: "Claudit", body: "Notifications enabled!" });
      }
    } catch (e) {
      console.error("Failed to request permission:", e);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await sendNotification({ title: "Claudit Test", body: "This is a test notification" });
      console.log("Test notification sent");
    } catch (e) {
      console.error("Failed to send test notification:", e);
    }
  };

  const handleToggle = (key: keyof AppSettings, value: boolean) => {
    if (!settings) return;
    updateSettingsMutation.mutate({
      ...settings,
      [key]: value,
    });
  };

  const handleUninstallHooks = async () => {
    setUninstalling(true);
    try {
      await invoke("uninstall_hooks");
      // Just invalidate the query instead of full page reload
      queryClient.invalidateQueries({ queryKey: ["hooks-status"] });
    } catch (e) {
      console.error("Failed to uninstall hooks:", e);
    } finally {
      setUninstalling(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure Claudit preferences
        </p>
      </div>

      {/* Hook Integration */}
      <SettingSection title="Claude Code Integration">
        <div className="py-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">
                <Webhook size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Hook Server</p>
                <p className="text-xs text-muted-foreground">
                  Receives events from Claude Code on port {hookPort ?? 3456}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-primary">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Running
              </span>
            </div>
          </div>
        </div>

        <div className="py-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Claude Code Hooks</p>
                <p className="text-xs text-muted-foreground">
                  {hooksInstalled
                    ? "Hooks installed in ~/.claude/settings.json"
                    : "Install hooks to enable real-time notifications"}
                </p>
              </div>
            </div>
            <div>
              {hooksInstalled ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-primary">
                    <Check size={14} />
                    Installed
                  </span>
                  <button
                    onClick={handleUninstallHooks}
                    disabled={uninstalling}
                    className="px-2 py-1 text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded transition-colors"
                  >
                    {uninstalling ? "Removing..." : "Remove"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => installHooksMutation.mutate()}
                  disabled={installHooksMutation.isPending}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {installHooksMutation.isPending ? "Installing..." : "Install"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="py-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">
                <Terminal size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Claude CLI Path</p>
                <p className="text-xs text-muted-foreground">
                  {settings.claude_cli_path
                    ? "Custom path configured"
                    : "Auto-detected (default)"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.claude_cli_path || ""}
                onChange={(e) => {
                  updateSettingsMutation.mutate({
                    ...settings,
                    claude_cli_path: e.target.value || undefined,
                  });
                }}
                placeholder="Auto-detect"
                className="w-48 px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground placeholder:text-muted-foreground/50"
              />
              <button
                onClick={async () => {
                  const selected = await open({
                    multiple: false,
                    directory: false,
                    title: "Select Claude CLI Binary",
                  });
                  if (selected) {
                    updateSettingsMutation.mutate({
                      ...settings,
                      claude_cli_path: selected as string,
                    });
                  }
                }}
                className="p-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
                title="Browse..."
              >
                <FolderOpen size={14} />
              </button>
              {settings.claude_cli_path && (
                <button
                  onClick={() => {
                    updateSettingsMutation.mutate({
                      ...settings,
                      claude_cli_path: undefined,
                    });
                  }}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">
                <Terminal size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Terminal App</p>
                <p className="text-xs text-muted-foreground">
                  Terminal to use for session resume
                </p>
              </div>
            </div>
            <select
              value={settings.terminal_app || "auto"}
              onChange={(e) => {
                updateSettingsMutation.mutate({
                  ...settings,
                  terminal_app: e.target.value,
                });
              }}
              className="px-3 py-1.5 text-sm bg-secondary/50 border border-border rounded text-foreground"
            >
              <option value="auto">Auto-detect</option>
              <option value="Terminal">Terminal</option>
              <option value="iTerm">iTerm2</option>
              <option value="Warp">Warp</option>
              <option value="Alacritty">Alacritty</option>
              <option value="kitty">kitty</option>
            </select>
          </div>
        </div>
      </SettingSection>

      {/* Notifications */}
      <SettingSection title="Notifications">
        {/* Permission Status */}
        <div className="py-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">
                {notificationPermission ? (
                  <Check size={20} className="text-primary" />
                ) : (
                  <AlertCircle size={20} className="text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">System Permission</p>
                <p className="text-xs text-muted-foreground">
                  {notificationPermission === null
                    ? "Checking permission..."
                    : notificationPermission
                    ? "Permission granted — ensure Banners/Alerts enabled in System Settings → Notifications"
                    : "Permission required for notifications"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {notificationPermission ? (
                <button
                  onClick={handleTestNotification}
                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-sm transition-colors"
                >
                  Test
                </button>
              ) : (
                <button
                  onClick={handleRequestPermission}
                  disabled={requestingPermission}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {requestingPermission ? "Requesting..." : "Grant Permission"}
                </button>
              )}
            </div>
          </div>
        </div>

        <SettingRow
          icon={<Bell size={20} />}
          title="Enable Notifications"
          description="Show system notifications when Claude finishes responding"
        >
          <Toggle
            enabled={settings.notifications_enabled}
            onChange={(v) => handleToggle("notifications_enabled", v)}
            disabled={!hooksInstalled || !notificationPermission}
          />
        </SettingRow>
      </SettingSection>

      {/* Display Options */}
      <SettingSection title="Tray Menu Display">
        <SettingRow
          icon={<Eye size={20} />}
          title="Show Messages"
          description="Display message count in tray menu"
        >
          <Toggle
            enabled={settings.show_messages}
            onChange={(v) => handleToggle("show_messages", v)}
          />
        </SettingRow>

        <SettingRow
          icon={<Eye size={20} />}
          title="Show Tokens"
          description="Display token counts in tray menu"
        >
          <Toggle
            enabled={settings.show_tokens}
            onChange={(v) => handleToggle("show_tokens", v)}
          />
        </SettingRow>

        <SettingRow
          icon={<Eye size={20} />}
          title="Show Cost"
          description="Display cost information in tray menu"
        >
          <Toggle
            enabled={settings.show_cost}
            onChange={(v) => handleToggle("show_cost", v)}
          />
        </SettingRow>

        <SettingRow
          icon={<Eye size={20} />}
          title="Show Burn Rate"
          description="Display tokens/min and $/hr in tray menu"
        >
          <Toggle
            enabled={settings.show_burn_rate}
            onChange={(v) => handleToggle("show_burn_rate", v)}
          />
        </SettingRow>

        <SettingRow
          icon={<Eye size={20} />}
          title="Show Sessions"
          description="Display session count in tray menu"
        >
          <Toggle
            enabled={settings.show_sessions}
            onChange={(v) => handleToggle("show_sessions", v)}
          />
        </SettingRow>

        <SettingRow
          icon={<Eye size={20} />}
          title="Show Model Breakdown"
          description="Display per-model stats in tray menu"
        >
          <Toggle
            enabled={settings.show_model_breakdown}
            onChange={(v) => handleToggle("show_model_breakdown", v)}
          />
        </SettingRow>
      </SettingSection>

      {/* Advanced */}
      <SettingSection title="Advanced">
        <SettingRow
          icon={<SettingsIcon size={20} />}
          title="Compact Mode"
          description="Use a more compact tray menu layout"
        >
          <Toggle
            enabled={settings.compact_mode}
            onChange={(v) => handleToggle("compact_mode", v)}
          />
        </SettingRow>
      </SettingSection>

      {/* Pricing Reference */}
      <SettingSection title="Token Pricing">
        <div className="py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-muted-foreground">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Model Pricing</p>
              <p className="text-xs text-muted-foreground">
                Cost per 1 million tokens (MTok) used for calculations
              </p>
            </div>
          </div>
          {pricing && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left py-2 pr-2 font-medium">Model</th>
                    <th className="text-right py-2 px-2 font-medium">Input</th>
                    <th className="text-right py-2 px-2 font-medium">Output</th>
                    <th className="text-right py-2 px-2 font-medium">Cache Read</th>
                    <th className="text-right py-2 pl-2 font-medium">Cache Write</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.map((model) => (
                    <tr key={model.model_name} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pr-2 text-foreground">{model.model_name}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">${model.input.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">${model.output.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">${model.cache_read.toFixed(2)}</td>
                      <td className="text-right py-2 pl-2 text-muted-foreground">${model.cache_write.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground/60 mt-3">
            Source:{" "}
            <a
              href="https://docs.anthropic.com/en/docs/about-claude/models"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Anthropic Model Pricing
            </a>
          </p>
        </div>
      </SettingSection>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground/60">
        Made by{" "}
        <a
          href="https://github.com/flipace"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          @flipace
        </a>{" "}
        and{" "}
        <a
          href="https://claude.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          Claude Code
        </a>
      </div>
    </div>
  );
}
