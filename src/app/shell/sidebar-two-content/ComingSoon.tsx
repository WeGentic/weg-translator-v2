import { Sparkles } from "lucide-react";

import { Card } from "@/shared/ui/card";

/**
 * Coming soon placeholder for Sidebar_two content.
 * Used for routes that don't have sidebar content yet.
 */
export function ComingSoon() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Sparkles className="size-12 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Coming Soon</h3>
          <p className="text-xs text-muted-foreground">
            This feature is under development
          </p>
        </div>
      </Card>
    </div>
  );
}
