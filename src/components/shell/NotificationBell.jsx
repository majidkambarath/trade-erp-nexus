import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2 } from "lucide-react";
import { Modal, EmptyState, Spinner, ErrorNote, useAsync, formatDateTime } from "../accounting/kit.jsx";
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

function Feed({ onClose }) {
  const { data, loading, error, reload, setData } = useAsync(() => notifications.list(), []);

  // kit.jsx's useAsync.setData replaces the whole value - it takes no updater function - so the next value
  // is built from `data` in this closure, not from a callback's own argument.
  const openRow = (n) => {
    onClose(); // following the link leaves the feed, same as any other navigation away from a dialog
    if (n.read) return;
    setData({ ...data, items: data.items.map((i) => (i.id === n.id ? { ...i, read: true } : i)), counts: { ...data.counts, unread: Math.max(0, data.counts.unread - 1) } });
    notifications.markRead(n.id).then(announceNotificationsChanged).catch(() => reload());
  };

  const markAllRead = () => {
    setData({ ...data, items: data.items.map((i) => ({ ...i, read: true })), counts: { ...data.counts, unread: 0 } });
    notifications.markAllRead().then(announceNotificationsChanged).catch(() => reload());
  };

  return (
    <Modal title="Notifications" onClose={onClose} size="sm">
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
        </>
      )}
    </Modal>
  );
}

// The bell lives in TopBar, visible to anyone signed in (a row's audience can be any permission, so there
// is no single one to hide the bell itself behind - see NavBadges.jsx). The feed only fetches once opened.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const count = useNavBadge("notifications");
  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
          className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:h-9 lg:w-9"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>
        <CountPill count={count} label="unread" className="absolute end-0.5 top-0.5" />
      </div>
      {open && <Feed onClose={() => setOpen(false)} />}
    </>
  );
}
