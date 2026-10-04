import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Inbox, Loader2, X } from "lucide-react";
import ReactSelect from "react-select";
import { cn } from "../../lib/utils";
import { toastClasses } from "../../lib/status";
import { drCr } from "../../utils/format";

// Small building blocks shared by the accounting, reporting, batch and e-invoicing screens.
// Everything here reads the existing design tokens (bg-card, border-border, brand-soft, status
// tones) so these screens look like the rest of the app in both themes.

// ---------- layout ----------

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, bodyClassName }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-status-danger/25 bg-status-danger-soft p-4 text-sm text-status-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{error.message || String(error)}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

// ---------- status ----------

const TONES = {
  neutral: "bg-secondary text-muted-foreground border-border",
  info: "bg-status-info-soft text-status-info border-status-info/25",
  warning: "bg-status-warning-soft text-status-warning border-status-warning/25",
  success: "bg-status-success-soft text-status-success border-status-success/25",
  danger: "bg-status-danger-soft text-status-danger border-status-danger/25",
};

export function Pill({ tone = "neutral", children, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>
      {children}
    </span>
  );
}

// An amount with its side: "1,312.50 Dr" or "300.00 Cr". Zero shows no side.
export function Balance({ net, className }) {
  const { text, side } = drCr(net);
  return (
    <span className={cn("tabular-nums", className)}>
      {text}
      {side && <abbr title={side === "Dr" ? "Debit balance" : "Credit balance"} className="ms-1 text-[11px] font-semibold uppercase text-muted-foreground no-underline">{side}</abbr>}
    </span>
  );
}

// ---------- forms ----------

export const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-status-danger";

// Label, control, hint and error, wired together with ids so screen readers announce them.
export function Field({ label, hint, error, required, className, children }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hint && hintId, error && errId].filter(Boolean).join(" ") || undefined,
        required: children.props.required ?? undefined,
      })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span aria-hidden="true" className="ms-0.5 text-status-danger">*</span>}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errId} className="text-xs font-medium text-status-danger">{error}</p>}
    </div>
  );
}

export const TextInput = React.forwardRef(function TextInput({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...p} />;
});

export const Select = React.forwardRef(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(inputClass, "pe-8", className)} {...p}>
      {children}
    </select>
  );
});

// A select you can type into. Use it wherever the list can be long (accounts, groups, customers,
// banks): type to filter by name or code, arrow keys to move, Enter to choose, Escape to close.
// It is a drop-in for the native Select: `value` is the chosen option's value and `onChange`
// receives that value as a string ("" when cleared).
//   options: [{ value, label, searchText?, depth?, hint? }]   depth indents a child under its parent
const searchStyles = (invalid) => ({
  control: (base, s) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    borderColor: invalid ? "var(--status-danger)" : s.isFocused ? "var(--ring)" : "var(--input)",
    boxShadow: s.isFocused ? "0 0 0 2px color-mix(in srgb, var(--ring) 40%, transparent)" : "none",
    backgroundColor: "var(--background)",
    fontSize: 14,
    cursor: "text",
    ":hover": { borderColor: invalid ? "var(--status-danger)" : "var(--ring)" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 12px" }),
  singleValue: (base) => ({ ...base, color: "var(--foreground)" }),
  input: (base) => ({ ...base, color: "var(--foreground)", margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, color: "var(--muted-foreground)" }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "var(--muted-foreground)", padding: "0 10px" }),
  clearIndicator: (base) => ({ ...base, color: "var(--muted-foreground)", padding: "0 6px" }),
  menu: (base) => ({ ...base, zIndex: 70, borderRadius: 10, overflow: "hidden", backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-elevated, 0 10px 30px rgba(0,0,0,.18))" }),
  menuPortal: (base) => ({ ...base, zIndex: 70 }),
  menuList: (base) => ({ ...base, padding: 4, maxHeight: 280 }),
  option: (base, s) => ({
    ...base,
    fontSize: 14,
    borderRadius: 6,
    cursor: "pointer",
    backgroundColor: s.isSelected ? "var(--primary)" : s.isFocused ? "var(--accent)" : "transparent",
    color: s.isSelected ? "var(--primary-foreground)" : "var(--foreground)",
    ":active": { backgroundColor: "var(--accent)" },
  }),
  noOptionsMessage: (base) => ({ ...base, color: "var(--muted-foreground)", fontSize: 14 }),
});

const norm = (v) => String(v ?? "").toLowerCase();
const matches = (option, input) => {
  const q = norm(input).trim();
  if (!q) return true;
  const hay = `${option.data.label} ${option.data.searchText || ""} ${option.data.hint || ""}`;
  return q.split(/\s+/).every((word) => norm(hay).includes(word));
};

export function SearchSelect({
  id, value, onChange, options, placeholder = "Choose…", clearable = false, disabled = false, loading = false,
  invalid, autoFocus = false, noOptionsText = "Nothing matches", className, ...aria
}) {
  const selected = options.find((o) => String(o.value) === String(value ?? "")) || null;
  // Escape closes the list when it is open; only an Escape pressed with the list already closed
  // reaches the dialog around it. The list is flagged on the native event so the dialog can tell.
  const listOpen = useRef(false);
  return (
    <ReactSelect
      onMenuOpen={() => { listOpen.current = true; }}
      onMenuClose={() => { listOpen.current = false; }}
      onKeyDown={(e) => { if (e.key === "Escape" && listOpen.current && e.nativeEvent) e.nativeEvent.escapeHandledByList = true; }}
      inputId={id}
      className={className}
      classNamePrefix="search-select"
      styles={searchStyles(Boolean(invalid ?? aria["aria-invalid"]))}
      options={options}
      value={selected}
      onChange={(opt) => onChange?.(opt ? String(opt.value) : "")}
      isClearable={clearable}
      isDisabled={disabled}
      isLoading={loading}
      autoFocus={autoFocus}
      placeholder={placeholder}
      noOptionsMessage={() => noOptionsText}
      filterOption={matches}
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      menuPosition="fixed"
      aria-label={aria["aria-label"]}
      aria-invalid={aria["aria-invalid"]}
      aria-describedby={aria["aria-describedby"]}
      aria-required={aria.required || undefined}
      formatOptionLabel={(o, { context }) => (
        <span className="flex min-w-0 items-baseline gap-2" style={context === "menu" && o.depth ? { paddingInlineStart: o.depth * 14 } : undefined}>
          <span className="truncate">{o.label}</span>
          {o.hint && <span className="shrink-0 text-xs opacity-70">{o.hint}</span>}
        </span>
      )}
    />
  );
}

export const Textarea = React.forwardRef(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} rows={3} className={cn(inputClass, "h-auto py-2", className)} {...p} />;
});

// ---------- dialog ----------

// A modal dialog. Escape closes it; focus moves in on open and returns on close. Clicking the
// backdrop does NOT close it, so a half-typed form is never lost to a stray click.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ title, description, onClose, children, footer, size = "md" }) {
  const titleId = useId();
  const ref = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    // a field that grabbed focus itself (a search select with autoFocus) keeps it
    if (!ref.current?.contains(document.activeElement)) {
      const first = ref.current?.querySelector("[data-autofocus]") || ref.current?.querySelector(FOCUSABLE);
      first?.focus();
    }
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      // a dropdown that was open has already handled this key: it closes, the dialog stays
      if (e.nativeEvent?.escapeHandledByList) return;
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== "Tab") return;
    // keep Tab inside the dialog
    const nodes = [...ref.current.querySelectorAll(FOCUSABLE)];
    if (!nodes.length) return;
    const [a, z] = [nodes[0], nodes[nodes.length - 1]];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };

  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("flex max-h-[min(90vh,52rem)] w-full flex-col rounded-2xl border border-border bg-card shadow-elevated", width)}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="erp-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- data ----------

// Runs an async loader and tracks its state. `reload` re-runs it; a stale response from an
// earlier call never overwrites a newer one.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const run = useRef(0);
  const load = useCallback(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(loader)
      .then((data) => id === run.current && setState({ data, loading: false, error: null }))
      .catch((error) => id === run.current && setState((s) => ({ ...s, loading: false, error })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

// Toasts: a card with a coloured edge (lib/status). One at a time, auto-dismissed.
export function useToasts() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const notify = useCallback((message, type = "success") => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = toast ? (
    <div role="status" className={cn("fixed bottom-4 end-4 z-[70] flex max-w-sm items-start gap-2", toastClasses(toast.type))}>
      {toast.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" aria-hidden="true" />}
      <p className="text-sm">{toast.message}</p>
    </div>
  ) : null;
  return { notify, toastNode: node };
}

export const errorMessage = (err) => err?.message || "Something went wrong";

// A yes/no question that names the consequence. The confirm button says what it does.
export function ConfirmDialog({ title, text, confirmLabel = "Confirm", danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Modal
      size="sm" title={title} onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent">Cancel</button>
          <button
            type="button" onClick={onConfirm} disabled={busy} data-autofocus
            className={cn("inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-primary-foreground disabled:opacity-60", danger ? "bg-destructive" : "bg-primary")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{text}</p>
    </Modal>
  );
}

const DATETIME = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" });
export const formatDateTime = (d) => (d ? DATETIME.format(new Date(d)) : "");
