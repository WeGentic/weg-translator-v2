import { useState } from "react";
import { EyeOff, Terminal } from "lucide-react";

import { useLayoutStoreApi } from "@/app/shell/MainLayout";
import type { AppHealthReport } from "@/core/ipc";
import { useSupabaseHealth } from "@/app/hooks/useSupabaseHealth";

import { Button } from "@/shared/ui/button";
import "@/shared/styles/layout/chrome/footer/workspace-footer.css";

/**
 * Persistently renders health telemetry for the desktop shell and offers a quick hide action.
 */
export function WorkspaceFooter({
  health,
}: {
  health: AppHealthReport | null;
}) {
  const layoutStore = useLayoutStoreApi();
  const [isLoggerExpanded, setIsLoggerExpanded] = useState(false);

  // Initialize Supabase health monitoring with 60-second polling for authenticated users
  const { healthResult } = useSupabaseHealth();

  // Hiding the footer routes through the store to keep all layout metrics in sync.
  const handleHide = () => {
    layoutStore.getState().setFooter({ visible: false });
    setIsLoggerExpanded(false);
  };

  const handleToggleLogger = () => {
    const newExpandedState = !isLoggerExpanded;
    setIsLoggerExpanded(newExpandedState);

    // Update footer height in the layout store
    const newHeight = newExpandedState ? 300 : 56;
    layoutStore.getState().setFooter({ height: newHeight });
  };

  return (
    <footer className={`workspace-footer ${isLoggerExpanded ? 'workspace-footer--expanded' : ''}`}>
      <div className="workspace-footer__content">
        <div className="workspace-footer__top">
          <div className="workspace-footer__metrics">
            <FooterMetric label="App" value={health?.appVersion ?? "—"} />
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              background: healthResult?.status === 'connected' ? '#22c55e' : '#f59e0b',
              color: 'white'
            }}>
              {healthResult?.status === 'connected'
                ? `✓ DB ${healthResult.latency}ms`
                : healthResult?.status === 'disconnected'
                ? '✗ DB Error'
                : '⟳ Checking...'
              }
            </div>
          </div>
          <div className="workspace-footer__actions">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleToggleLogger}
              className="workspace-footer__log-button"
            >
              <Terminal className="mr-2 h-4 w-4" aria-hidden="true" />
              {isLoggerExpanded ? 'Hide Logs' : 'Logs'}
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={handleHide}>
              <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
              Hide footer
            </Button>
          </div>
        </div>

        {isLoggerExpanded && (
          <div className="workspace-footer__logger">
            <LoggerPlaceholder />
          </div>
        )}
      </div>
    </footer>
  );
}

/**
 * Display helper that prints a compact metric block consisting of a label and value.
 */
function FooterMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="workspace-footer__metric">
      <span className="workspace-footer__metric-label">
        {label}
      </span>
      <span className="workspace-footer__metric-value">{value}</span>
    </div>
  );
}

/**
 * Placeholder logger component with mock log entries for demonstration purposes.
 */
function LoggerPlaceholder() {
  const mockLogs = [
    { timestamp: "14:32:15", level: "INFO", message: "Translation service initialized" },
    { timestamp: "14:32:16", level: "DEBUG", message: "Loading project configuration..." },
    { timestamp: "14:32:17", level: "INFO", message: "Connected to translation API" },
    { timestamp: "14:32:18", level: "WARN", message: "Rate limit approaching for API calls" },
    { timestamp: "14:32:19", level: "INFO", message: "File processing complete: document.xliff" },
  ];

  return (
    <div className="workspace-footer__logger-content">
      <div className="workspace-footer__logger-header">
        <h4 className="workspace-footer__logger-title">Application Logs</h4>
        <span className="workspace-footer__logger-status">Live</span>
      </div>
      <div className="workspace-footer__logger-entries">
        {mockLogs.map((log) => (
          <div key={`${log.timestamp}-${log.level}`} className="workspace-footer__logger-entry">
            <span className="workspace-footer__logger-timestamp">{log.timestamp}</span>
            <span className={`workspace-footer__logger-level workspace-footer__logger-level--${log.level.toLowerCase()}`}>
              {log.level}
            </span>
            <span className="workspace-footer__logger-message">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
