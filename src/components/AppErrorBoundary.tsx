import {
  Component,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from "react";
import { AlertCircle, Copy, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { logger } from "@/logging";

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

const isDev = import.meta.env.DEV;

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

  const handleCopyDetails = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      void logger.warn("Clipboard API is not available in this environment.");
      return;
    }

    void navigator.clipboard.writeText(details).catch((copyError) => {
      void logger.error("Unable to copy error details", copyError);
    });
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <Alert variant="destructive" className="border-destructive/40">
          <AlertCircle className="col-start-1" />
          <AlertTitle>We hit an unexpected snag</AlertTitle>
          <AlertDescription>
            <p className="text-sm">
              The section you were viewing failed to render. You can try again, and if the issue
              persists please share the error details with the team.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={resetErrorBoundary} className="gap-2">
                <RefreshCw className="size-4" aria-hidden="true" />
                Try again
              </Button>
              <Button variant="outline" onClick={handleCopyDetails} className="gap-2">
                <Copy className="size-4" aria-hidden="true" />
                Copy error details
              </Button>
            </div>
            {isDev ? (
              <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-left text-xs text-muted-foreground">
                {details}
              </pre>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

export default AppErrorBoundary;
