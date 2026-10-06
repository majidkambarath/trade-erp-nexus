import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // max-w-full + scroll: a row of tabs that does not fit used to make the PAGE wider
        // than the screen, which scrolled every card's left edge out of view. The track
        // scrolls inside itself instead, and the page keeps its width.
        "bg-secondary/80 text-muted-foreground inline-flex h-12 w-fit max-w-full items-center justify-center rounded-full p-1 border-0 lg:h-11",
        "scrollbar-none overflow-x-auto overscroll-x-contain",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // shrink-0 so a tab keeps its label instead of being squeezed when the row scrolls
        "inline-flex h-full min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold lg:min-h-0 transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
