import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

type TabsListProps = ComponentProps<typeof TabsPrimitive.List>;
function TabsList({ className, ref: forwardedRef, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      {...props}
      ref={forwardedRef}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
    />
  );
}
TabsList.displayName = TabsPrimitive.List.displayName;

type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger>;
function TabsTrigger({ className, ref: forwardedRef, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      {...props}
      ref={forwardedRef}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className,
      )}
    />
  );
}
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

type TabsContentProps = ComponentProps<typeof TabsPrimitive.Content>;
function TabsContent({ className, ref: forwardedRef, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      {...props}
      ref={forwardedRef}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    />
  );
}
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };