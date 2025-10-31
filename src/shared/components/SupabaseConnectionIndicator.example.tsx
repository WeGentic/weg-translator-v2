/**
 * Example usage of SupabaseConnectionIndicator component with useSupabaseHealth hook.
 *
 * This file demonstrates how to integrate the health indicator into different contexts.
 * NOT included in build - for documentation purposes only.
 */

import { useSupabaseHealth } from "@/app/hooks/useSupabaseHealth";
import { SupabaseConnectionIndicator } from "./SupabaseConnectionIndicator";

/**
 * Example 1: Basic usage in a page component
 */
export function LoginPageExample() {
  const { healthResult } = useSupabaseHealth();

  return (
    <div>
      <h1>Login Page</h1>
      {/* Login form components */}

      <SupabaseConnectionIndicator
        status={healthResult?.status || "checking"}
        latency={healthResult?.latency}
        error={healthResult?.error}
        className="mt-4"
      />
    </div>
  );
}

/**
 * Example 2: Usage in footer with polling for authenticated users
 */
export function FooterExample() {
  // Automatically polls every 60 seconds
  const { healthResult } = useSupabaseHealth({ pollingInterval: 60000 });

  return (
    <footer>
      <div className="flex items-center gap-4">
        <span>App Version: 1.0.0</span>

        <SupabaseConnectionIndicator
          status={healthResult?.status || "checking"}
          latency={healthResult?.latency}
          error={healthResult?.error}
        />
      </div>
    </footer>
  );
}

/**
 * Example 3: Conditional rendering based on status
 */
export function ConditionalExample() {
  const { healthResult, retry } = useSupabaseHealth();

  if (healthResult?.status === "disconnected") {
    return (
      <div className="flex flex-col items-center gap-2">
        <SupabaseConnectionIndicator
          status="disconnected"
          error={healthResult.error}
        />
        <button onClick={retry} className="btn-primary">
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <SupabaseConnectionIndicator
      status={healthResult?.status || "checking"}
      latency={healthResult?.latency}
    />
  );
}

/**
 * Example 4: All three states
 */
export function AllStatesExample() {
  return (
    <div className="space-y-4">
      <div>
        <h3>Checking State</h3>
        <SupabaseConnectionIndicator status="checking" />
      </div>

      <div>
        <h3>Connected State (with latency)</h3>
        <SupabaseConnectionIndicator status="connected" latency={45} />
      </div>

      <div>
        <h3>Connected State (without latency)</h3>
        <SupabaseConnectionIndicator status="connected" />
      </div>

      <div>
        <h3>Disconnected State (with error)</h3>
        <SupabaseConnectionIndicator
          status="disconnected"
          error="Network timeout after 3 seconds"
        />
      </div>

      <div>
        <h3>Disconnected State (without error)</h3>
        <SupabaseConnectionIndicator status="disconnected" />
      </div>
    </div>
  );
}
