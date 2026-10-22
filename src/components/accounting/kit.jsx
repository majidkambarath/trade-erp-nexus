import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, Inbox, X } from "lucide-react";
import ReactSelect from "react-select";
import CreatableSelect from "react-select/creatable";
import { cn } from "../../lib/utils";
import { toastClasses } from "../../lib/status";
import { dialCodeOf, dialOptions, joinPhone, splitPhone } from "../../lib/phoneNumbers";
import { DISCARD_LABEL, DISCARD_TEXT, DISCARD_TITLE, KEEP_LABEL, useTypedIn, useUnsavedWork } from "../../lib/unsavedWork";
import { orgCountry } from "../../utils/orgLocale";
import { caretAfter, displayAmount, groupAmount, meaningBefore, sanitizeAmount } from "../../lib/numberInput";
import { NUMBER_LOCALE, drCr, formatDate, getDateFormat, parseDate } from "../../utils/format";
import { DataTable, ErrorNote, PageSpinner, Spinner, TableScroll } from "./DataTable";

export { DataTable, TableScroll };

// Small building blocks shared by the accounting, reporting, batch and e-invoicing screens.
// Everything here reads the existing design tokens (bg-card, border-border, brand-soft, status
// tones) so these screens look like the rest of the app in both themes.

// ---------- layout ----------

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {/* On a phone the actions get their own row and stretch, so a primary button is a
          full-width target rather than a 90px one in the corner. */}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 [&>*]:min-h-11 [&>*]:flex-1 sm:[&>*]:min-h-0 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, bodyClassName }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
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

export { Spinner, PageSpinner, ErrorNote };

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

// h-11 (44px) on touch, h-10 on a pointer: the minimum comfortable target without
// loosening every form on a desktop screen.
export const inputClass =
  "h-11 lg:h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-status-danger";

// Label, control, hint and error, wired together with ids so screen readers announce them.
export function Field({ label, hint, error, required, className, labelClassName, children }) {
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
      <label htmlFor={id} className={cn("text-sm font-medium text-foreground", labelClassName)}>
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

// An amount typed with the grouping the organisation's country uses: 20,000 in Dubai, 1,20,000 in India
// (src/lib/numberInput.js, the same table the figures beside it are formatted from). A drop-in for
// <input type="number"> on a money or quantity field: `value` and the value in the change event are the
// plain number as text ("20000.5"), never the grouped text, so a form that stores and sends what the
// field reports needs no change.
//
// It is type="text" because a native number input refuses to hold a comma at all. That loses the
// spinner arrows, which are no use on an amount, and the browser's own "not a number" check, which the
// field does itself by accepting nothing else. `inputMode="decimal"` still brings up the numeric keypad.
export const AmountInput = React.forwardRef(function AmountInput(
  { value = "", onChange, onBlur, className, inputClassName, disabled, required, id, name, placeholder, maxDecimals, allowNegative, min, ...rest },
  ref
) {
  const locale = NUMBER_LOCALE;
  const negatives = allowNegative ?? !(min !== undefined && Number(min) >= 0);
  const opts = { allowNegative: negatives, maxDecimals };
  const box = useRef(null);
  // where the caret must land after this edit, counted in the characters that carry meaning: the commas
  // around them move as the number grows ("1,234|" + "5" is "12,345|", four characters further on)
  const caret = useRef(null);

  const shown = displayAmount(value, locale, opts);

  useEffect(() => {
    const el = box.current;
    if (caret.current === null || !el) return;
    const at = caretAfter(el.value, caret.current);
    caret.current = null;
    try {
      el.setSelectionRange(at, at);
    } catch {
      /* a field that does not carry a selection (it is text, so it does) */
    }
  });

  function change(e) {
    const el = e.target;
    const typed = el.value;
    const want = meaningBefore(typed, el.selectionStart);
    caret.current = want;
    const clean = sanitizeAmount(typed, opts);
    // Draw the grouped text straight onto the field, and put the caret back where it was. A comma the
    // person typed where the field had already drawn one leaves the stored value untouched, so there is
    // no re-render to do it for us - and writing to `value` alone sends the caret to the end.
    el.value = groupAmount(clean, locale);
    const at = caretAfter(el.value, want);
    try {
      el.setSelectionRange(at, at);
    } catch {
      /* no selection to place (jsdom on a field it does not model) */
    }
    onChange?.({ target: { id, name, type: "number", value: clean }, type: "change" });
  }

  return (
    <input
      ref={(node) => {
        box.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onChange={change}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      // `inputClassName` replaces the kit's own look, the way DateInput lets a screen with its own
      // field styling keep it; `className` adds to whichever is in force.
      className={cn(inputClassName || inputClass, className)}
      {...rest}
    />
  );
});

// A date field that shows and accepts dates the way the person chose to read them (Settings >
// Preferences: 04/10/2026, 2026-10-04, 04 Oct 2026...), instead of the browser's own regional
// format. Type it, or open the calendar. `value` and the value in the change event are ISO
// "YYYY-MM-DD", exactly like a native date input, so it is a drop-in for <input type="date">.
export const DateInput = React.forwardRef(function DateInput(
  { value = "", onChange, onBlur, min, max, className, inputClassName, disabled, required, id, name, placeholder, ...aria },
  ref
) {
  const pattern = getDateFormat();
  const show = (iso) => (iso ? formatDate(iso, pattern) : "");
  const [text, setText] = useState(show(value));
  const [bad, setBad] = useState(false);
  const picker = useRef(null);
  // The ISO date this field has just reported from the person's own typing. Its echo (the parent
  // passing the same date back as `value`) must not rewrite the text being typed: in YYYY-MM-DD,
  // "2026-03-1" already reads as the 1st, and showing "2026-03-01" at once would turn the next
  // digit into "2026-03-017" - so the 10th to the 31st could not be typed. The text is tidied on leaving.
  const echo = useRef(null);
  // follow the value from outside (a quick range, a reset) and a changed format
  useEffect(() => {
    if (echo.current !== null && echo.current === value) { echo.current = null; setBad(false); return; }
    echo.current = null;
    setText(show(value));
    setBad(false);
  }, [value, pattern]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (iso) => onChange?.({ target: { id, name, type: "date", value: iso }, type: "change" });

  function change(e) {
    const typed = e.target.value;
    setText(typed);
    if (!typed.trim()) { setBad(false); if (value) { echo.current = ""; emit(""); } return; }
    const iso = parseDate(typed, pattern);
    // min / max guide the calendar only, as on a native date field: the form explains a date out of range
    if (iso) { setBad(false); if (iso !== value) { echo.current = iso; emit(iso); } } else setBad(true);
  }
  function leave(e) {
    echo.current = null;
    setText(show(value)); // an unfinished or impossible date is not kept; a good one is shown the way the format writes it
    setBad(false);
    onBlur?.(e);
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={ref} id={id} name={name} type="text" inputMode="numeric" autoComplete="off" value={text} onChange={change} onBlur={leave}
        placeholder={placeholder ?? pattern} disabled={disabled} required={required} maxLength={16}
        {...aria} aria-invalid={bad || aria["aria-invalid"] || undefined}
        className={cn(inputClassName || inputClass, "pe-10")}
      />
      <input
        ref={picker} type="date" tabIndex={-1} aria-hidden="true" disabled={disabled} value={value || ""} min={min} max={max}
        onChange={(e) => e.target.value && emit(e.target.value)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
      <button
        type="button" tabIndex={-1} disabled={disabled} aria-label="Open calendar"
        onClick={() => { try { picker.current?.showPicker?.(); } catch { /* not allowed here: type the date instead */ } }}
        className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 lg:end-1.5 lg:h-7 lg:w-7"
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
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
const searchStyles = (invalid, compact, menuWidth) => ({
  control: (base, s) => ({
    ...base,
    minHeight: compact ? 36 : 40,
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
  // A narrow control (the dialling-code box is 112px) would otherwise open a list as narrow as itself,
  // with every country name clipped in it. `menuWidth` lets the list be as wide as it needs to be.
  menu: (base) => ({ ...base, zIndex: 70, borderRadius: 10, overflow: "hidden", backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-elevated, 0 10px 30px rgba(0,0,0,.18))", ...(menuWidth ? { width: menuWidth, minWidth: menuWidth } : null) }),
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

// With `rankMatches`, what was typed puts the best match first: the name itself, then names that begin with it, then a word that
// begins with it, then the rest (each group in the list's own order). react-select keeps the list's order, so typing "India" and
// pressing Enter chose "British Indian Ocean Territory", which is alphabetically first. Opt-in, so no other list changes order.
const rankText = (text, q) => {
  const value = norm(text);
  if (!value) return 4;
  if (value === q) return 0;
  if (value.startsWith(q)) return 1;
  if (value.split(/[\s\-/_(),]+/).some((word) => word.startsWith(q))) return 2;
  return 3;
};
// The label, then the hint, whichever reads closer. A list whose label is not the thing a person
// types needs this: the dialling-code box is labelled "+971" and named "United Arab Emirates" in its
// hint, so ranking the label alone would score "India" against "+246" and choose the British Indian
// Ocean Territory - the same mistake, in a new place, that `rankMatches` was added to fix.
const rankOf = (option, q) => Math.min(rankText(option.label, q), rankText(option.hint, q));
const rankedBy = (options, typed) => {
  const q = norm(typed).trim();
  if (!q) return options;
  return options
    .map((option, index) => [option, index, rankOf(option, q)])
    .sort((a, b) => a[2] - b[2] || a[1] - b[1])
    .map(([option]) => option);
};

export function SearchSelect({
  id, value, onChange, options, placeholder = "Choose…", clearable = false, disabled = false, loading = false,
  invalid, autoFocus = false, compact = false, noOptionsText = "Nothing matches", rankMatches = false,
  // `hintInListOnly`: the hint names the option in the LIST, but the box shows the label alone. For a
  // control too narrow to hold both - the dialling-code box shows "+971", the list "+971 United Arab
  // Emirates" - because the hint does not shrink and the label does, so in a narrow box the hint wins
  // and the label, which is the thing chosen, collapses to nothing.
  hintInListOnly = false, menuWidth,
  className, ...aria
}) {
  const selected = options.find((o) => String(o.value) === String(value ?? "")) || null;
  const [typed, setTyped] = useState("");
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
      styles={searchStyles(Boolean(invalid ?? aria["aria-invalid"]), compact, menuWidth)}
      options={rankMatches ? rankedBy(options, typed) : options}
      onInputChange={rankMatches ? (text, meta) => setTyped(meta.action === "input-change" ? text : "") : undefined}
      value={selected}
      onChange={(opt) => onChange?.(opt ? String(opt.value) : "")}
      isClearable={clearable}
      isDisabled={disabled}
      isLoading={loading}
      autoFocus={autoFocus}
      placeholder={placeholder}
      // a function is given what was typed, so the message can tell "no match for that" from "nothing to choose"
      noOptionsMessage={({ inputValue }) => (typeof noOptionsText === "function" ? noOptionsText(inputValue || "") : noOptionsText)}
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
          {o.hint && !(hintInListOnly && context === "value") && <span className="shrink-0 text-xs opacity-70">{o.hint}</span>}
        </span>
      )}
    />
  );
}

// A SearchSelect that also offers to create whatever was typed, when nothing matches it - the quick-add
// pattern requested for every master picker across the app (category, vendor, unit of measure, ...)
// instead of a separate "+ New" button opening a full modal: type, see "Add '<text>'" at the foot of the
// list, choose it, and the new record exists and is selected in one step. `onCreate` does the actual
// work (POST to that master's own create endpoint) and resolves to the option to select - the component
// does not know or care which master it is talking to, matching the app's existing pattern of thin,
// explicit per-screen API modules over one generic backend. Nothing here is forced on an existing native
// `<select>` or plain `SearchSelect` - this is an additional component, not a change to either.
//
//   <QuickAddSelect
//     value={categoryId} onChange={setCategoryId} options={categoryOptions}
//     onCreate={async (name) => { const cat = await categories.create({ name }); return { value: cat._id, label: cat.name }; }}
//     placeholder="Search or add a category…"
//   />
//
// Omitting `onCreate` degrades to a plain SearchSelect with no creatable affordance - a screen can pass
// it conditionally (a role without create permission, say) and nothing else changes.
//
// Testing note: react-select's own "create" option, unlike clicking an EXISTING option, does not reliably
// fire onCreateOption from a bare `fireEvent.click` in jsdom - send `fireEvent.mouseDown` then
// `fireEvent.click` on it (found the hard way: the click resolved, the option was real and correctly
// wired, and onCreate simply never ran - no error, nothing to see without instrumenting the handler
// itself to prove it was never reached).
export function QuickAddSelect({
  id, value, onChange, options, onCreate, onCreated, onCreateError,
  createLabel = (text) => `Add "${text}"`,
  placeholder = "Search or add…", clearable = false, disabled = false, loading = false,
  invalid, autoFocus = false, compact = false, noOptionsText = "Nothing matches", className, ...aria
}) {
  const [creating, setCreating] = useState(false);
  // The newly created option shows as selected at once, whether or not the caller's own `options` list
  // has been refreshed yet (onCreated is a courtesy for a caller that keeps its own cache - it is not
  // required for correctness here).
  const [justCreated, setJustCreated] = useState(null);
  // every hook above this line - the early return below changes what the component RETURNS, not which
  // hooks run (the same rule DataTable's own selection code follows, for the same reason)
  const listOpen = useRef(false);
  const known = options.some((o) => String(o.value) === String(value ?? ""));
  const allOptions = justCreated && !known ? [...options, justCreated] : options;

  if (!onCreate) {
    return (
      <SearchSelect
        id={id} value={value} onChange={onChange} options={allOptions} placeholder={placeholder} clearable={clearable}
        disabled={disabled} loading={loading} invalid={invalid} autoFocus={autoFocus} compact={compact}
        noOptionsText={noOptionsText} className={className} {...aria}
      />
    );
  }

  const selected = allOptions.find((o) => String(o.value) === String(value ?? "")) || null;
  const exists = (text) => allOptions.some((o) => norm(o.label) === norm(text));

  const create = async (inputValue) => {
    const text = inputValue.trim();
    if (!text || exists(text)) return; // CreatableSelect already withholds this via isValidNewOption, kept here too against a direct call
    setCreating(true);
    try {
      const created = await onCreate(text);
      setJustCreated(created);
      onChange?.(String(created.value));
      onCreated?.(created);
    } catch (err) {
      onCreateError?.(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <CreatableSelect
      inputId={id}
      onMenuOpen={() => { listOpen.current = true; }}
      onMenuClose={() => { listOpen.current = false; }}
      onKeyDown={(e) => { if (e.key === "Escape" && listOpen.current && e.nativeEvent) e.nativeEvent.escapeHandledByList = true; }}
      className={className}
      classNamePrefix="search-select"
      styles={searchStyles(Boolean(invalid ?? aria["aria-invalid"]), compact)}
      options={allOptions}
      value={selected}
      onChange={(opt) => onChange?.(opt ? String(opt.value) : "")}
      onCreateOption={create}
      isValidNewOption={(text) => Boolean(text.trim()) && !exists(text)}
      formatCreateLabel={createLabel}
      isClearable={clearable}
      isDisabled={disabled}
      isLoading={loading || creating}
      autoFocus={autoFocus}
      placeholder={placeholder}
      noOptionsMessage={({ inputValue }) => (typeof noOptionsText === "function" ? noOptionsText(inputValue || "") : noOptionsText)}
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

// A phone number in its two halves: the country's dialling code, then the number.
//
// A drop-in for <TextInput type="tel">. `value` is the whole number as it is stored ("+971501234567")
// and the change event carries the whole number back, in the same synthetic shape DateInput uses, so
// a form that already does `onChange={set("phone")}` needs no other change.
//
// The code box starts on the organisation's own country - the right answer for nearly every number
// anybody types - and follows a stored number's own code where it has one. lib/phoneNumbers.js says
// what is stored, and what is deliberately not validated.
export const PhoneInput = React.forwardRef(function PhoneInput(
  { value = "", onChange, onBlur, className, disabled, required, id, name, placeholder = "50 123 4567", autoComplete = "tel", ...aria },
  ref
) {
  const home = orgCountry();
  // The country is remembered, not worked out afresh on every render: a dialling code shared by
  // several countries (+1 is twenty-odd of them) must stay on the one the person chose, and clearing
  // the number must not throw that choice away.
  const [chosen, setChosen] = useState(() => splitPhone(value, home).iso);
  const shown = splitPhone(value, chosen || home);
  // a number that arrived from outside carrying its own code wins: this is an edit opening on a record
  const country = shown.code && shown.code !== dialCodeOf(chosen) ? shown.iso : chosen || shown.iso;

  // What is in the number box is NOT what is stored. Somebody typing "050 123 4567" must see the
  // spaces as they type them, while "+971501234567" is what is saved; deriving the box from the
  // stored number instead ate every space and the leading 0 one keystroke after they were typed.
  // So the box holds its own text, and its echo - the form handing the same number straight back -
  // must not rewrite what is half typed. (DateInput keeps the same guard, for the same reason.)
  const [text, setText] = useState(shown.national);
  const echo = useRef(null);
  useEffect(() => {
    if (echo.current !== null && echo.current === value) {
      echo.current = null;
      return;
    }
    echo.current = null;
    setText(splitPhone(value, chosen || home).national);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (next) => {
    echo.current = next;
    onChange?.({ target: { id, name, type: "tel", value: next }, type: "change" });
  };

  const change = (e) => {
    // A phone number is digits and the punctuation people write them with. Letters simply do not go
    // in, which is plainer than taking them and complaining afterwards.
    const kept = e.target.value.replace(/[^\d\s()+-]/g, "");
    // ...and what the filter leaves behind of a word - "call me" is a space - is not a number either
    const typed = /[\d+]/.test(kept) ? kept : "";
    // A whole international number pasted into the number half: take it as what it is, rather than
    // putting this country's code in front of another country's number.
    if (/^\s*(\+|00)/.test(typed)) {
      const pasted = splitPhone(typed, country);
      if (pasted.code) {
        setChosen(pasted.iso);
        setText(pasted.national);
        emit(joinPhone(pasted.iso, pasted.national));
        return;
      }
    }
    setText(typed);
    emit(joinPhone(country, typed));
  };

  // Leaving the box shows exactly what will be saved, so the screen and the record never disagree.
  const leave = (e) => {
    echo.current = null;
    setText(splitPhone(value, country).national);
    onBlur?.(e);
  };

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="w-28 shrink-0 sm:w-32">
        <SearchSelect
          // Its own label: the field's label belongs to the number box, which is the one a person
          // types in and the one `Field` wires its hint and its error to.
          aria-label="Country dialling code"
          value={country}
          onChange={(next) => {
            setChosen(next);
            emit(joinPhone(next, text)); // the number does not change, only the code in front of it
          }}
          options={dialCodeOptions(home)}
          disabled={disabled}
          placeholder="Code"
          rankMatches
          hintInListOnly
          menuWidth={300}
        />
      </div>
      <input
        ref={ref}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={text}
        onChange={change}
        onBlur={leave}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={18}
        {...aria}
        className={cn(inputClass, "min-w-0 flex-1")}
      />
    </div>
  );
});

// Built once per country rather than on every keystroke: 240 options, each with its name looked up
// through Intl.
let dialCache = { home: null, options: null };
function dialCodeOptions(home) {
  if (dialCache.home !== home) dialCache = { home, options: dialOptions(home) };
  return dialCache.options;
}

// ---------- dialog ----------

// A modal dialog. Escape closes it; focus moves in on open and returns on close. Clicking the
// backdrop does NOT close it, so a half-typed form is never lost to a stray click.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ title, description, onClose, children, footer, size = "md", confirmClose, dirty, unsavedLabel }) {
  const titleId = useId();
  const ref = useRef(null);
  // Has the person put anything into this dialog that closing it would throw away? A dialog that
  // keeps its own "changed since it opened" flag passes `dirty` and that is the answer. One that
  // does not (most of them: a small master form holds its state in half a dozen useStates) is
  // watched instead - the first time a trusted keystroke or a changed box comes out of it, there is
  // something to lose. That way every dialog in the app asks before it drops what was typed,
  // without each one having to grow a baseline of its own, and a dialog with nothing to type in
  // (an audit trail, a history, a preview) stays as quiet as it always was.
  //
  // What the watching cannot see: choosing from a SearchSelect without typing, and a Radix switch
  // or checkbox (both are buttons, so neither fires an input or change event). A dialog where that
  // is the whole of the editing should pass `dirty` itself.
  const [typed, watchTyping] = useTypedIn(dirty === undefined);
  const unsaved = dirty === undefined ? typed : Boolean(dirty);
  const [asking, setAsking] = useState(false);
  // While there is something unsaved: warn before a reload, and tell the guard around the pages, so
  // a rail link or the Back button asks too instead of taking the dialog away mid-sentence.
  useUnsavedWork(unsaved, unsavedLabel || (typeof title === "string" && title ? `the “${title}” form` : ""));

  useEffect(() => {
    const previous = document.activeElement;
    // a field that grabbed focus itself (a search select with autoFocus) keeps it
    if (!ref.current?.contains(document.activeElement)) {
      const first = ref.current?.querySelector("[data-autofocus]") || ref.current?.querySelector(FOCUSABLE);
      first?.focus();
    }
    return () => previous?.focus?.();
  }, []);

  // `confirmClose`, when given, is asked before the dialog actually closes (Escape or the X button) and may
  // refuse by returning false - a form with something unsaved can ask "discard your changes?" instead of
  // losing them to one keystroke or a stray click. The dialog stays open with focus exactly where it was.
  const requestClose = () => {
    if (confirmClose && confirmClose() === false) return;
    if (unsaved) {
      setAsking(true); // the question is asked over the dialog; the dialog itself stays exactly as it was
      return;
    }
    onClose?.();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      // a dropdown that was open has already handled this key: it closes, the dialog stays
      if (e.nativeEvent?.escapeHandledByList) return;
      e.stopPropagation();
      requestClose();
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
  // On a phone this is a bottom sheet: flush to the bottom edge, full width, square at the
  // foot and rounded at the head, with the page showing above it. From md up it is the
  // centred dialog it has always been.
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
      onKeyDown={onKeyDown}
      {...watchTyping}
    >
      <div
        ref={ref}
        role="dialog"
        aria-labelledby={titleId}
        className={cn(
          "flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-elevated",
          "md:max-h-[min(90dvh,52rem)] md:rounded-2xl",
          width
        )}
      >
        <header className="relative flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 pb-3 pt-4 md:px-6 md:py-4">
          {/* grab handle, phones only - the sheet's own affordance */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-border md:hidden"
          />
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground md:h-8 md:w-8">
            <X className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="erp-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">{children}</div>
        {/* The footer is the sheet's action bar on a phone: buttons stretch and clear the
            home bar, so the primary action is always reachable with a thumb. */}
        {footer && (
          <footer className="pb-safe flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 md:px-6 md:py-3.5 [&>button]:min-h-11 [&>button]:flex-1 md:[&>button]:min-h-0 md:[&>button]:flex-none">
            {footer}
          </footer>
        )}
      </div>
      {/* Outside the dialog's own box on purpose: inside it, this question's buttons would join the
          dialog's Tab ring and its Escape would reach the dialog's own key handler. */}
      {asking && (
        <ConfirmDialog
          title={DISCARD_TITLE}
          text={DISCARD_TEXT}
          confirmLabel={DISCARD_LABEL}
          cancelLabel={KEEP_LABEL}
          danger
          safeDefault
          onConfirm={() => {
            setAsking(false);
            onClose?.();
          }}
          onClose={() => setAsking(false)}
        />
      )}
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
    <div
      role="status"
      className={cn(
        // clears the bottom bar (3.5rem + the device inset) below lg
        "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] end-3 start-3 z-[70] flex items-start gap-2",
        "lg:bottom-4 lg:start-auto lg:max-w-sm",
        toastClasses(toast.type)
      )}
    >
      {toast.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" aria-hidden="true" />}
      <p className="text-sm">{toast.message}</p>
    </div>
  ) : null;
  return { notify, toastNode: node };
}

export const errorMessage = (err) => err?.message || "Something went wrong";

// A yes/no question that names the consequence. The confirm button says what it does.
// `typeToConfirm` (e.g. "delete") makes the confirm button wait until the user has typed that word.
// Use it for anything that removes a record, so a stray click or Enter cannot delete it.
// `safeDefault` puts the opening focus on Cancel instead: use it where confirming loses something
// (discarding a form), so a stray Enter keeps the work rather than throwing it away.
export function ConfirmDialog({ title, text, confirmLabel = "Confirm", cancelLabel = "Cancel", safeDefault = false, danger = false, busy = false, typeToConfirm = "", onConfirm, onClose }) {
  const [typed, setTyped] = useState("");
  const matches = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.toLowerCase();
  const inputId = useId();
  const confirm = () => {
    if (matches && !busy) onConfirm();
  };
  return (
    <Modal
      size="sm" title={title} onClose={onClose}
      // The word typed to confirm a deletion is not unsaved work: Cancel here must simply cancel.
      dirty={false}
      footer={
        <>
          <button type="button" onClick={onClose} data-autofocus={safeDefault || undefined} className="inline-flex h-11 items-center justify-center rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent md:h-10">{cancelLabel}</button>
          <button
            type="button" onClick={confirm} disabled={busy || !matches} data-autofocus={(!safeDefault && !typeToConfirm) || undefined}
            className={cn("inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 md:h-10", danger ? "bg-destructive" : "bg-primary")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{text}</p>
      {typeToConfirm && (
        <div className="mt-4 space-y-1.5">
          <label htmlFor={inputId} className="block text-sm">
            Type <span className="font-semibold text-foreground">{typeToConfirm}</span> to confirm
          </label>
          <input
            id={inputId}
            autoFocus
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}
    </Modal>
  );
}

export { formatDateTime } from "../../utils/format";
