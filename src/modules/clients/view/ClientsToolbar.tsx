import { type ChangeEvent } from "react";
import { Filter, Plus, Search, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";

import {
  CLIENT_FILTER_OPTIONS,
  type ClientsFilterValue,
} from "@/modules/clients/constants";

export interface ClientsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: ClientsFilterValue;
  onFilterChange: (next: ClientsFilterValue) => void;
  onAddClient: () => void;
}

export function ClientsToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
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

  function handleFilterValueChange(nextValue: string) {
    if (nextValue === filter) return;
    onFilterChange(nextValue as ClientsFilterValue);
  }

  return (
    <TooltipProvider>
      <div className="dashboard-toolbar-zone" role="toolbar" aria-label="Clients toolbar">
        <div className="flex h-full w-full items-center justify-between gap-3 px-3">
          <div className="group relative flex-1 max-w-md">
            <label htmlFor="clients-search-input" className="sr-only">
              Search clients
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70 transition-opacity duration-200 group-focus-within:opacity-100" />
            <Input
              id="clients-search-input"
              type="search"
              value={search}
              onChange={handleSearchInputChange}
              placeholder="Search clients…"
              className="h-9 pl-9 pr-9"
              aria-label="Search clients"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/60 transition-all duration-200 hover:bg-[var(--color-tr-muted)]/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-[var(--color-tr-ring)] focus-visible:outline-offset-2"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <label htmlFor="clients-filter-select" className="sr-only">
                Filter clients
              </label>
              <Select value={filter} onValueChange={handleFilterValueChange}>
                <SelectTrigger
                  id="clients-filter-select"
                  className="h-9 w-[170px] border-border/50 bg-background/70 text-sm transition-all duration-200 hover:border-border/70 hover:bg-background/80 focus:ring-2 focus:ring-ring/60"
                  aria-label="Filter clients"
                >
                  <Filter className="mr-2 h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  <SelectValue placeholder="Filter clients" />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-md">
                  {CLIENT_FILTER_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="data-[highlighted]:bg-[var(--color-tr-primary-blue)] data-[highlighted]:text-[var(--color-tr-anti-primary)] data-[state=checked]:bg-[var(--color-tr-secondary)] data-[state=checked]:text-[var(--color-tr-navy)] data-[state=checked]:font-semibold"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-3 font-medium"
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
