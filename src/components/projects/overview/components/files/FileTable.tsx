import { useMemo, useState, useCallback } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Filter,
  FilePenLine,
  RefreshCw,
  Trash2,
  FileText,
  Upload,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import { FileStatusIndicator } from "./FileStatusIndicator";
import { FilterChips, type FileFilters } from "./FilterChips";
import type { ProjectFileWithConversionsDto, ProjectFileConversionDto } from "@/ipc";
import { cn } from "@/lib/utils";

const FILE_TABLE_SKELETON_KEYS = ["loader-1", "loader-2", "loader-3"] as const;

type SortField = "name" | "size" | "status" | "type";
type SortDirection = "asc" | "desc" | null;

interface FileTableRow {
  id: string;
  name: string;
  ext: string;
  size?: number;
  importStatus: string;
  conversions: ProjectFileConversionDto[];
  type: string;
}

interface Props {
  files: ProjectFileWithConversionsDto[];
  isLoading?: boolean;
  onOpenEditor: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onRebuild: (fileId: string) => void;
  onAddFiles?: () => void;
  rebuildingFileId?: string | null;
}

export function FileTable({
  files,
  isLoading = false,
  onOpenEditor,
  onRemove,
  onRebuild,
  onAddFiles,
  rebuildingFileId,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(() => new Set());
  const [filters, setFilters] = useState<FileFilters>(() => ({
    fileTypes: new Set(),
    statuses: new Set(),
    languagePairs: new Set(),
  }));
  const [showFilters, setShowFilters] = useState(false);

  // Transform files to table rows
  const rows = useMemo<FileTableRow[]>(
    () =>
      files.map((fileData) => ({
        id: fileData.file.id,
        name: fileData.file.originalName,
        ext: fileData.file.ext,
        size: fileData.file.sizeBytes,
        importStatus: fileData.file.importStatus,
        conversions: fileData.conversions,
        type: fileData.file.ext || "unknown",
      })),
    [files],
  );

  // Filter and sort rows
  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((row) =>
        row.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply chip filters
    if (filters.fileTypes.size > 0) {
      filtered = filtered.filter((row) =>
        filters.fileTypes.has(row.ext.replace(/^\./, "").toUpperCase())
      );
    }

    if (filters.statuses.size > 0) {
      filtered = filtered.filter((row) => {
        // Check import status
        if (filters.statuses.has(row.importStatus)) return true;
        // Check conversion statuses
        return row.conversions.some(conv => filters.statuses.has(conv.status));
      });
    }

    if (filters.languagePairs.size > 0) {
      filtered = filtered.filter((row) =>
        row.conversions.some(conv =>
          filters.languagePairs.has(`${conv.srcLang}→${conv.tgtLang}`)
        )
      );
    }

    // Apply sorting
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number = "";
        let bValue: string | number = "";

        switch (sortField) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "size":
            aValue = a.size || 0;
            bValue = b.size || 0;
            break;
          case "status":
            aValue = a.importStatus;
            bValue = b.importStatus;
            break;
          case "type":
            aValue = a.type.toLowerCase();
            bValue = b.type.toLowerCase();
            break;
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          const result = aValue.localeCompare(bValue);
          return sortDirection === "asc" ? result : -result;
        } else {
          const result = (aValue as number) - (bValue as number);
          return sortDirection === "asc" ? result : -result;
        }
      });
    }

    return filtered;
  }, [rows, searchTerm, sortField, sortDirection, filters]);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    setSelectedFiles((prev) => {
      if (prev.size === filteredAndSortedRows.length) {
        return new Set();
      }
      return new Set(filteredAndSortedRows.map((row) => row.id));
    });
  }, [filteredAndSortedRows]);

  const handleSelectFile = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  // Format file size
  const formatSize = useCallback((size?: number) => {
    if (!size || size <= 0) return "—";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 10.24) / 100} KB`;
    return `${Math.round(size / 10485.76) / 100} MB`;
  }, []);

  // Format file extension
  const formatExt = useCallback((ext: string) => {
    if (!ext) return "";
    return ext.replace(/^\./, "").slice(0, 4).toUpperCase();
  }, []);

  // Get sort icon
  const getSortIcon = useCallback((field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="ml-1 h-3 w-3" />;
    }
    if (sortDirection === "desc") {
      return <ArrowDown className="ml-1 h-3 w-3" />;
    }
    return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
  }, [sortField, sortDirection]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="space-y-2">
          {FILE_TABLE_SKELETON_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-4 p-4">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <Upload className="h-10 w-10 text-primary/60" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">No files yet</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          Get started by adding translation files to your project. Supported formats include XLIFF, TMX, and more.
        </p>
        {onAddFiles && (
          <div className="space-y-3">
            <Button onClick={onAddFiles} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Files
            </Button>
            <div className="text-xs text-muted-foreground">
              Or use the add button in the header
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-8"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "gap-2",
              showFilters && "bg-muted/50"
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          {(searchTerm || filters.fileTypes.size > 0 || filters.statuses.size > 0 || filters.languagePairs.size > 0) && (
            <div className="text-sm text-muted-foreground">
              {filteredAndSortedRows.length} of {rows.length} files
            </div>
          )}
        </div>

        {/* Filter chips */}
        {showFilters && (
          <FilterChips
            files={files}
            filters={filters}
            onFiltersChange={setFilters}
          />
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedFiles.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2">
          <div className="text-sm font-medium text-foreground">
            {selectedFiles.size} file{selectedFiles.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setSelectedFiles(new Set())}>
              Clear
            </Button>
            <Button variant="outline" size="sm" disabled>
              Rebuild Selected
            </Button>
            <Button variant="outline" size="sm" disabled>
              Remove Selected
            </Button>
          </div>
        </div>
      )}

      {/* Empty filtered state */}
      {filteredAndSortedRows.length === 0 && rows.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-sm font-medium text-foreground">No files match your filters</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Try adjusting your search term or filters to find what you're looking for
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setFilters({
                fileTypes: new Set(),
                statuses: new Set(),
                languagePairs: new Set()
              });
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Table */}
      {filteredAndSortedRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <input
                  type="checkbox"
                  checked={selectedFiles.size === filteredAndSortedRows.length && filteredAndSortedRows.length > 0}
                  onChange={handleSelectAll}
                  className="rounded"
                />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center">
                  Name
                  {getSortIcon("name")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("type")}
              >
                <div className="flex items-center">
                  Type
                  {getSortIcon("type")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("size")}
              >
                <div className="flex items-center">
                  Size
                  {getSortIcon("size")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center">
                  Status
                  {getSortIcon("status")}
                </div>
              </TableHead>
              <TableHead>Conversions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedRows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  "transition-colors",
                  selectedFiles.has(row.id) && "bg-muted/30"
                )}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(row.id)}
                    onChange={() => handleSelectFile(row.id)}
                    className="rounded"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/60 text-xs font-semibold uppercase text-muted-foreground">
                      {formatExt(row.ext) || <FileText className="h-4 w-4" />}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenEditor(row.id)}
                      className="truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline focus:text-primary focus:underline focus:outline-none"
                      title={row.name}
                    >
                      {row.name}
                    </button>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium uppercase">
                    {formatExt(row.ext) || "FILE"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatSize(row.size)}
                  </span>
                </TableCell>
                <TableCell>
                  <FileStatusIndicator
                    importStatus={row.importStatus}
                    conversions={row.conversions}
                    showProgress={true}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {row.conversions.length > 0 ? (
                      row.conversions.slice(0, 2).map((conv) => (
                        <span
                          key={conv.id}
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs",
                            conv.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : conv.status === "running"
                              ? "bg-primary/10 text-primary"
                              : conv.status === "failed"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {conv.srcLang}→{conv.tgtLang}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground/70">None</span>
                    )}
                    {row.conversions.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{row.conversions.length - 2} more
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconTooltipButton
                      label="Open in editor"
                      ariaLabel={`Open ${row.name} in editor`}
                      onClick={() => onOpenEditor(row.id)}
                    >
                      <FilePenLine className="h-4 w-4" />
                    </IconTooltipButton>
                    <IconTooltipButton
                      label="Rebuild conversions"
                      ariaLabel={`Rebuild conversions for ${row.name}`}
                      onClick={() => onRebuild(row.id)}
                      tone="muted"
                      disabled={row.conversions.length === 0 || rebuildingFileId === row.id}
                    >
                      <RefreshCw className={cn("h-4 w-4", rebuildingFileId === row.id && "animate-spin")} />
                    </IconTooltipButton>
                    <IconTooltipButton
                      label="Remove file"
                      ariaLabel={`Remove file ${row.name}`}
                      onClick={() => onRemove(row.id)}
                      tone="destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconTooltipButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  );
}
