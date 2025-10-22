import { type ChangeEvent } from "react";
import { Plus, Search, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import "@/shared/styles/buttons.css";
import "./client-search.css";

export interface ClientsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAddClient: () => void;
}

export function ClientsToolbar({
  search,
  onSearchChange,
  onAddClient,
}: ClientsToolbarProps) {
  function handleSearchInputChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (value === search) return;
    onSearchChange(value);
  }

  function handleClearSearch() {
    if (!search) return;
    onSearchChange("");
  }

  return (
    <TooltipProvider>
      <div className="dashboard-toolbar-zone" role="toolbar" aria-label="Clients toolbar">
        <div className="flex h-full w-full items-center justify-between gap-3 px-3">
          <div className="group relative flex-1 max-w-md">
            <label htmlFor="clients-search-input" className="sr-only">
              Search clients
            </label>
            <Search className="
            pointer-events-none
            absolute left-3
            top-1/2 h-3.5 w-3.5 -translate-y-1/2
            text-(--color-victorian-peacock-900)/70
            transition-opacity duration-200 group-focus-within:opacity-100" />
            <Input
              id="clients-search-input"
              type="search"
              value={search}
              onChange={handleSearchInputChange}
              placeholder="Search clients…"
              className="client-search-input"
              aria-label="Search clients"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/60 transition-all duration-200 hover:bg-[var(--color-muted)]/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="add-button"
                  onClick={onAddClient}
                  aria-label="Add new client"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add client
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add a new client profile</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
