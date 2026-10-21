import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2, X } from "lucide-react";
import { Modal, EmptyState, Spinner, ErrorNote, useAsync, formatDateTime } from "../accounting/kit.jsx";
import { useMediaQuery, WIDE } from "../accounting/DataTable";
import { cn } from "../../lib/utils";
import { notifications, announceNotificationsChanged } from "../../lib/notificationsApi";
import { useNavBadge, CountPill } from "./NavBadges";

const DOT = { info: "bg-status-info", warning: "bg-status-warning", critical: "bg-status-danger" };

function Row({ n, onOpen }) {
  const content = (
    <>
      <span aria-hidden="true" className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[n.severity] || DOT.info)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", n.read ? "text-muted-foreground" : "font-semibold text-foreground")}>{n.title}</p>
        {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.occurredAt)}</p>
      </div>
      {!n.read && <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
    </>
  );
  const className = "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-secondary";
  // A row the server gave no link to is read as soon as it is seen, not on a click that goes nowhere.
  if (!n.link) return <div className={className}>{content}</div>;
  return (
    <Link to={n.link} className={className} onClick={() => onOpen(n)}>
      {content}
    </Link>
  );
}

// The rows themselves, shared by the two shapes below, so mark-all-read and read-on-open are written once.
function FeedBody({ onClose }) {
  const { data, loading, error, reload, setData } = useAsync(() => notifications.list(), []);

  // kit.jsx's useAsync.setData replaces the whole value - it takes no updater function - so the next value
  // is built from `data` in this closure, not from a callback's own argument.
  const openRow = (n) => {
    onClose(); // following the link leaves the feed, same as any other navigation away from it
    if (n.read) return;
    setData({ ...data, items: data.items.map((i) => (i.id === n.id ? { ...i, read: true } : i)), counts: { ...data.counts, unread: Math.max(0, data.counts.unread - 1) } });
    notifications.markRead(n.id).then(announceNotificationsChanged).catch(() => reload());
  };

  const markAllRead = () => {
    setData({ ...data, items: data.items.map((i) => ({ ...i, read: true })), counts: { ...data.counts, unread: 0 } });
    notifications.markAllRead().then(announceNotificationsChanged).catch(() => reload());
  };

  return (
    <>
      {loading && <Spinner label="Loading notifications" />}
      <ErrorNote error={error} onRetry={reload} />
      {!loading && !error && data && data.items.length === 0 && (
        <EmptyState title="You're all caught up" text="Nothing waiting for your attention right now." />
      )}
      {!loading && !error && data && data.items.length > 0 && (
        <>
          {data.counts.unread > 0 && (
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{data.counts.unread} unread</p>
              <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            </div>
          )}
          <ul className="-mx-1 flex flex-col divide-y divide-border">
            {data.items.map((n) => (
              <li key={n.id}>
                <Row n={n} onOpen={openRow} />
              </li>
            ))}
          </ul>
          {data.capped && (
            <p className="px-3 pt-3 text-[11px] text-muted-foreground">Showing the newest notifications only.</p>
          )}
        </>
      )}
    </>
  );
}

const PANEL_WIDTH = 384; // 24rem: wide enough for a two-line title, narrow enough to leave the page readable
const PANEL_MAX_HEIGHT = 512;

// Where the panel hangs: under the bell, its right edge against the bell's, in viewport pixels. The header is
// fixed (the shell is `fixed inset-0`, see Layout.jsx) so nothing but a resize can move the button under it.
function placeFrom(button) {
  const vw = document.documentElement.clientWidth || window.innerWidth || PANEL_WIDTH;
  const vh = document.documentElement.clientHeight || window.innerHeight || PANEL_MAX_HEIGHT;
  const r = button?.getBoundingClientRect();
  const top = (r?.bottom || 56) + 8;
  const right = Math.max(8, vw - (r?.right || vw - 8));
  return {
    top,
    right,
    width: Math.min(PANEL_WIDTH, vw - 16),
    maxHeight: Math.max(220, Math.min(PANEL_MAX_HEIGHT, vh - top - 16)),
  };
}

// On a pointer the feed is a dropdown hanging off the bell, not a dialog in the middle of the window: a centred
// box with nothing dimmed behind it reads as a panel that has come loose from the button that opened it.
function Panel({ anchorRef, onClose }) {
  const ref = useRef(null);
  const [place, setPlace] = useState(() => placeFrom(anchorRef.current));

  useEffect(() => {
    const sync = () => setPlace(placeFrom(anchorRef.current));
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [anchorRef]);

  // It is not modal: the page behind stays usable, so a press anywhere else simply closes it. The bell itself is
  // left out - it toggles, and closing here first would let that same press reopen the panel.
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose({ restoreFocus: true });
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchorRef, onClose]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      tabIndex={-1}
      style={place}
      className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elevated focus:outline-none"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        <button
          type="button"
          onClick={() => onClose({ restoreFocus: true })}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="erp-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <FeedBody onClose={onClose} />
      </div>
    </div>
  );
}

// The bell lives in TopBar, visible to anyone signed in (a row's audience can be any permission, so there
// is no single one to hide the bell itself behind - see NavBadges.jsx). The feed only fetches once opened.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const count = useNavBadge("notifications");
  const wide = useMediaQuery(WIDE);
  const button = useRef(null);

  const close = useCallback((opts) => {
    setOpen(false);
    if (opts?.restoreFocus) button.current?.focus();
  }, []);

  return (
    <>
      <div className="relative shrink-0">
        <button
          ref={button}
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:h-9 lg:w-9"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>
        <CountPill count={count} label="unread" className="absolute end-0.5 top-0.5" />
      </div>
      {/* Below md the sheet is right: it comes up from the bottom edge, where a thumb already is. */}
      {open && !wide && (
        <Modal title="Notifications" onClose={close} size="sm">
          <FeedBody onClose={close} />
        </Modal>
      )}
      {open && wide && <Panel anchorRef={button} onClose={close} />}
    </>
  );
}
