import {
  Component,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AlertCircle, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { logger } from "@/core/logging";

import "./css/app-error-boundary.css";

export interface ErrorBoundaryFallbackProps {
  error: Error;
  errorInfo?: ErrorInfo | null;
  resetErrorBoundary: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackRender?: (props: ErrorBoundaryFallbackProps) => ReactNode;
  FallbackComponent?: (props: ErrorBoundaryFallbackProps) => ReactElement | null;
  onReset?: (details: { error: Error | null; resetKeys?: Array<unknown> }) => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<unknown>;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

function arrayChanged(a: Array<unknown> = [], b: Array<unknown> = []) {
  if (a.length !== b.length) return true;
  return a.some((value, index) => Object.is(value, b[index]) === false);
}

//onst isDev = import.meta.env.DEV;

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    if (typeof window !== "undefined") {
      const scopedWindow = window as typeof window & {
        reportError?: (err: unknown) => void;
      };
      if (typeof scopedWindow.reportError === "function") {
        scopedWindow.reportError(error);
      }
    }

    void logger.error("AppErrorBoundary caught an error", error, {
      component_stack: errorInfo.componentStack,
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { error } = this.state;
    if (error && this.props.resetKeys && prevProps.resetKeys) {
      if (arrayChanged(prevProps.resetKeys, this.props.resetKeys)) {
        this.resetErrorBoundary();
      }
    }
  }

  private resetErrorBoundary = () => {
    const { error } = this.state;
    this.props.onReset?.({ error, resetKeys: this.props.resetKeys });
    this.setState({ error: null, errorInfo: null });
  };

  private renderFallback(): ReactNode {
    const { fallback, fallbackRender, FallbackComponent } = this.props;
    const { error, errorInfo } = this.state;

    if (!error) return null;

    const fallbackProps: ErrorBoundaryFallbackProps = {
      error,
      errorInfo,
      resetErrorBoundary: this.resetErrorBoundary,
    };

    if (typeof fallbackRender === "function") {
      return fallbackRender(fallbackProps);
    }

    if (FallbackComponent) {
      return <FallbackComponent {...fallbackProps} />;
    }

    if (fallback) {
      return fallback;
    }

    return <DefaultErrorFallback {...fallbackProps} />;
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

function stringifyErrorDetails(error: Error, errorInfo?: ErrorInfo | null): string {
  const header = `${error.name ?? "Error"}: ${error.message}`;
  const stack = error.stack ?? errorInfo?.componentStack ?? "<no stack trace available>";
  return `${header}\n\n${stack}`;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  resetErrorBoundary,
}: ErrorBoundaryFallbackProps) {
  const details = stringifyErrorDetails(error, errorInfo);
  //const [isDetailsOpen, setIsDetailsOpen] = useState(isDev);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const titleId = useId();
  const descriptionId = useId();
  const diagnosticsId = useId();
  const metaTitleId = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const errorTitle = error.name?.trim() || "Application error";
  const errorSummary =
    error.message?.trim() || "The operation was interrupted by an unexpected condition.";

  useEffect(() => {
    sectionRef.current?.focus();
  }, []);

  useEffect(() => {
    if (copyState !== "copied") return;
    if (typeof window === "undefined") return;

    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
      copyResetTimerRef.current = null;
    }, 2400);

    return () => {
      if (copyResetTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
    };
  }, [copyState]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
    };
  }, []);

  const handleCopyDetails = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      void logger.warn("Clipboard API is not available in this environment.");
      setCopyState("failed");
      return;
    }

    navigator.clipboard
      .writeText(details)
      .then(() => {
        setCopyState("copied");
      })
      .catch((copyError) => {
        setCopyState("failed");
        void logger.error("Unable to copy error details", copyError);
      });
  };

  return (
    <section
      ref={sectionRef}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      className="app-error-boundary"
    >
      <article
        className="app-error-boundary__panel"
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
      >
        <header className="app-error-boundary__header">
          <span className="app-error-boundary__icon" aria-hidden="true">
            <AlertCircle className="size-6" />
          </span>
          <div>
            <h2 id={titleId} className="app-error-boundary__title">
              We hit an unexpected snag
            </h2>
            <p id={descriptionId} className="app-error-boundary__subtitle">
              The section you were viewing failed to render. Try reloading it, or copy the technical
              details and share them with the team.
            </p>
          </div>
        </header>

        <div className="app-error-boundary__body">
          <div
            role="group"
            aria-labelledby={metaTitleId}
            className="app-error-boundary__meta"
          >
            <p id={metaTitleId} className="app-error-boundary__meta-title">
              Latest error report
            </p>
            <p className="app-error-boundary__meta-value" title={`${errorTitle}: ${errorSummary}`}>
              <span className="app-error-boundary__meta-label">{errorTitle}</span>
              {errorSummary}
            </p>
          </div>
        </div>

        <div
          className="app-error-boundary__actions"
          role="group"
          aria-label="Error recovery actions"
        >
          <Button onClick={resetErrorBoundary} className="app-error-boundary__action">
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </div>

        <section
          className="app-error-boundary__diagnostics"
          aria-labelledby={diagnosticsId}
        >
          <header className="app-error-boundary__diagnostics-header">
            <h3 id={diagnosticsId} className="app-error-boundary__heading">
              Diagnostics
            </h3>
          </header>

          <div className="app-error-boundary__diagnostics-actions">
            <Button
              variant="outline"
              onClick={handleCopyDetails}
              className="app-error-boundary__action app-error-boundary__action--secondary"
              aria-label="Copy the latest error log to the clipboard"
            >
              <Copy className="size-4" aria-hidden="true" />
              Copy log
            </Button>
            {/*
            <Button
              type="button"
              variant="ghost"
              className="app-error-boundary__action app-error-boundary__details-toggle"
              aria-expanded={isDetailsOpen}
              aria-controls={detailsId}
              onClick={() => setIsDetailsOpen((open) => !open)}
            >
              {isDetailsOpen ? "Hide technical details" : "Show technical details"}
            </Button>
            */}
          </div>

        <div
          role="status"
          aria-live="polite"
          className="app-error-boundary__copy-feedback"
          data-state={copyState}
        >
          {copyState === "copied"
            ? "Copied error details to clipboard."
            : copyState === "failed"
              ? "Unable to copy. Please try again."
              : "\u00a0"}
        </div>
{/*
        {isDetailsOpen ? (
          <pre id={detailsId} className="app-error-boundary__details">
            {details}
          </pre>
          ) : null} */}
        </section>
      </article>
    </section>
  );
}

export default AppErrorBoundary;
