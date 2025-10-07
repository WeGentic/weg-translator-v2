import type { ComponentPropsWithoutRef, Ref } from "react";

import { cn } from "@/shared/utils/class-names";

type TableProps = ComponentPropsWithoutRef<"table"> & {
  ref?: Ref<HTMLTableElement>;
};

function Table({ className, ref, ...props }: TableProps) {
  return (
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  );
}
Table.displayName = "Table";

type ElementTypeMap = {
  thead: HTMLTableSectionElement;
  tbody: HTMLTableSectionElement;
  tfoot: HTMLTableSectionElement;
};

type TableSectionProps<TElement extends keyof ElementTypeMap> = ComponentPropsWithoutRef<TElement> & {
  ref?: Ref<ElementTypeMap[TElement]>;
};

function TableHeader({ className, ref, ...props }: TableSectionProps<"thead">) {
  return <thead ref={ref} className={cn("bg-muted/70", className)} {...props} />;
}
TableHeader.displayName = "TableHeader";

function TableBody({ className, ref, ...props }: TableSectionProps<"tbody">) {
  return <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
TableBody.displayName = "TableBody";

function TableFooter({ className, ref, ...props }: TableSectionProps<"tfoot">) {
  return (
    <tfoot
      ref={ref}
      className={cn("bg-muted/40 font-medium text-foreground", className)}
      {...props}
    />
  );
}
TableFooter.displayName = "TableFooter";

type TableRowProps = ComponentPropsWithoutRef<"tr"> & {
  ref?: Ref<HTMLTableRowElement>;
};

function TableRow({ className, ref, ...props }: TableRowProps) {
  return (
    <tr
      ref={ref}
      className={cn("border-b border-border/60 transition-colors hover:bg-muted/50", className)}
      {...props}
    />
  );
}
TableRow.displayName = "TableRow";

type TableHeadProps = ComponentPropsWithoutRef<"th"> & {
  ref?: Ref<HTMLTableCellElement>;
};

function TableHead({ className, ref, ...props }: TableHeadProps) {
  return (
    <th
      ref={ref}
      className={cn(
        "h-10 px-4 text-left text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
TableHead.displayName = "TableHead";

type TableCellProps = ComponentPropsWithoutRef<"td"> & {
  ref?: Ref<HTMLTableCellElement>;
};

function TableCell({ className, ref, ...props }: TableCellProps) {
  return (
    <td ref={ref} className={cn("p-4 align-middle text-sm text-foreground/90", className)} {...props} />
  );
}
TableCell.displayName = "TableCell";

type TableCaptionProps = ComponentPropsWithoutRef<"caption"> & {
  ref?: Ref<HTMLTableCaptionElement>;
};

function TableCaption({ className, ref, ...props }: TableCaptionProps) {
  return (
    <caption ref={ref} className={cn("mt-4 text-xs text-muted-foreground", className)} {...props} />
  );
}
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
