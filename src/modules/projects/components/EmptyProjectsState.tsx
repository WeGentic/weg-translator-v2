// features/projects/components/EmptyProjectsState.tsx
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";

export function EmptyProjectsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-80 flex-col items-center justify-center gap-4 text-center animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative rounded-full border border-border/50 bg-gradient-to-br from-muted/60 to-muted/40 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-muted-foreground transition-colors duration-300 group-hover:text-primary"
            aria-hidden
          >
            <path
              d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"
              stroke="currentColor"
              strokeWidth="1.5"
              className="transition-all duration-300"
            />
            <path
              d="M12 10v6m-3-3h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          </svg>
        </div>
      </div>

      <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-700 delay-200">
        <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Create your first project to start translating files and managing your content with AI-powered tools.
        </p>
      </div>

      <Button
        type="button"
        onClick={onCreate}
        className="mt-4 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg transition-all hover:shadow-xl hover:scale-105 hover:from-primary/90 hover:to-primary animate-in slide-in-from-bottom-2 duration-700 delay-300"
        size="lg"
      >
        <Plus className="mr-2 h-5 w-5" aria-hidden />
        Create your first project
      </Button>
    </div>
  );
}