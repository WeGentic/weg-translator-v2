import { Search, LayoutGrid, Rows3 } from "lucide-react";

import type { ReactNode } from "react";

import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";

export type AssetFilters = {
  search: string;
  role: string;
  status: string;
};

export type AssetGrouping = "flat" | "role";

type ProjectViewAssetFiltersProps = {
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
  grouping: AssetGrouping;
  onGroupingChange: (grouping: AssetGrouping) => void;
  roleOptions: ReadonlyArray<{ value: string; label: string }>;
  statusOptions: string[];
  actionSlot?: ReactNode;
  disabled?: boolean;
};

export function ProjectViewAssetFilters({
  filters,
  onFiltersChange,
  grouping,
  onGroupingChange,
  roleOptions,
  statusOptions,
  actionSlot,
  disabled = false,
}: ProjectViewAssetFiltersProps) {
  return (
    <div className="project-overview__filters">
      <div className="project-overview__filters-left">
        <div className="project-overview__filters-search">
          <Search className="h-4 w-4 opacity-60" aria-hidden="true" />
          <Input
            value={filters.search}
            placeholder="Search assets"
            className="pl-8"
            disabled={disabled}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                search: event.target.value,
              })
            }
          />
        </div>

        <Select
          value={filters.role}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              role: value,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              status: value,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {formatStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="project-overview__filters-right">
        <div className="project-overview__grouping-toggle" role="group" aria-label="Grouping mode">
          <Button
            type="button"
            size="sm"
            variant={grouping === "flat" ? "secondary" : "ghost"}
            onClick={() => onGroupingChange("flat")}
            disabled={disabled}
          >
            <Rows3 className="mr-2 h-4 w-4" aria-hidden />
            Flat view
          </Button>
          <Button
            type="button"
            size="sm"
            variant={grouping === "role" ? "secondary" : "ghost"}
            onClick={() => onGroupingChange("role")}
            disabled={disabled}
          >
            <LayoutGrid className="mr-2 h-4 w-4" aria-hidden />
            Group by role
          </Button>
        </div>
        {actionSlot}
      </div>
    </div>
  );
}

function formatStatusLabel(status: string) {
  if (!status) return "Pending";
  return status.replace(/[_-]/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}
