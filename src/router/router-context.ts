import type { useAuth } from "@/app/providers";

export interface RouterContext {
  auth: ReturnType<typeof useAuth>;
}

