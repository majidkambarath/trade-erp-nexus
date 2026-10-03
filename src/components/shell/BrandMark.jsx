import React from "react";
import { Boxes } from "lucide-react";
import { cn } from "../../lib/utils";

// The brand's logo mark. Colour comes from the active brand pack (--brand).
export default function BrandMark({ className, iconClassName }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-primary-foreground",
        className
      )}
    >
      <Boxes className={cn("h-5 w-5", iconClassName)} strokeWidth={2.2} />
    </span>
  );
}
