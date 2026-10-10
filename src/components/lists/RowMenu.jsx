import React, { useCallback, useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// The "more" menu on a table row (Audit trail, Download, Delete ...). It opens on hover and on keyboard focus, as the row
// menus always have, but is placed with `position: fixed` from the button's own rectangle.
//
// Why not inside the row: a list's table sits in an `overflow-x-auto` box (which makes the other axis `auto` too) inside an
// `overflow-hidden` card. A menu positioned inside the row was cut off on the last rows and, while it was only hidden
// (opacity 0 / visibility hidden), still counted as scrollable overflow - a blank strip under the rows with a scrollbar of
// its own. A fixed menu is in neither box, and it opens upward when there is no room below.
//
// The items stay in the DOM while the menu is closed (`display: none`), so the markup and whatever presses an item are as before.
const MENU_ROOM = 200; // px: what a five-item menu needs below the button before it opens upward

const MENU = "w-36 rounded-2xl border border-border bg-card py-1 shadow-lg";
const BUTTON =
  "grid min-h-10 min-w-10 place-items-center rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary lg:min-h-0 lg:min-w-0";

export default function RowMenu({ children, label = "More actions", buttonClassName = BUTTON, menuClassName = MENU }) {
  const root = useRef(null);
  const [place, setPlace] = useState(null); // { right, top } | { right, bottom } in viewport pixels while open

  const show = useCallback(() => {
    const button = root.current?.querySelector("button");
    if (!button) return;
    const r = button.getBoundingClientRect();
    // the layout viewport without the page's scrollbar, which is what `fixed` offsets are measured from
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = document.documentElement.clientHeight || window.innerHeight;
    const right = Math.max(4, width - r.right);
    const below = height - r.bottom;
    setPlace(below < MENU_ROOM && r.top > below ? { right, bottom: height - r.top } : { right, top: r.bottom });
  }, []);
  const hide = useCallback(() => setPlace(null), []);

  // Placed in viewport pixels, so whatever moves the row would leave the menu behind: close it.
  useEffect(() => {
    if (!place) return undefined;
    const onScroll = (e) => {
      const t = e.target;
      if (!t || t === document || t === window || t.contains?.(root.current)) hide();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [place, hide]);

  return (
    <div
      ref={root}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) hide();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") hide();
      }}
    >
      <button type="button" aria-label={label} aria-haspopup="true" aria-expanded={Boolean(place)} className={buttonClassName}>
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {/* closing on a click lets a pointer user act and move on; the dialog an item opens is not covered by a lingering menu */}
      <div
        onClick={hide}
        style={place || undefined}
        className={cn(place ? "fixed z-50 block" : "hidden", menuClassName)}
      >
        {children}
      </div>
    </div>
  );
}
