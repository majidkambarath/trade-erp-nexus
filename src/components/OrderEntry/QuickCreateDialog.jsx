import React, { useEffect, useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { isRequired, missingRequired } from "./quickCreate";
import { cn } from "../../lib/utils";

// One dialog for every quick create. The field list comes from quickCreate.js, so the
// required fields are the same ones the management screens enforce.
//
// `pendingSelect` lets a nested create (a new category opened from inside a stock item)
// hand its new id back to the field that asked for it, without losing what was typed.
export default function QuickCreateDialog({
  open,
  onOpenChange,
  spec,
  initial,
  onCreate,
  options = {},
  onRequestNew,
  pendingSelect,
  onCloseFocus,
}) {
  const uid = useId();
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValues({ ...(initial || {}) });
      setError("");
      setBusy(false);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!pendingSelect || !open) return;
    setValues((v) => ({ ...v, [pendingSelect.field]: pendingSelect.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelect?.nonce]);

  if (!spec) return null;

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    const miss = missingRequired(spec, values);
    if (miss) {
      setError(`${miss.label} is required.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate(values);
      onOpenChange(false);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not create this record.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* No dimming: the page stays readable behind the dialog, matching the other popups */}
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-transparent" />
        <Dialog.Content
          aria-describedby={undefined}
          // Radix would return focus to the button that opened the dialog. A caller can take
          // over (return true) to send focus to the line that the new record belongs to.
          onCloseAutoFocus={(e) => {
            if (onCloseFocus?.()) e.preventDefault();
          }}
          className="fixed start-1/2 top-[18dvh] z-[60] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-6 text-foreground shadow-elevated rtl:translate-x-1/2"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-bold tracking-tight">{spec.title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center lg:h-9 lg:w-9 rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form onSubmit={submit} noValidate className="space-y-4">
            {spec.fields.map((f) => {
              const id = `${uid}-${f.name}`;
              const isSelect = Boolean(f.select);
              const opts = isSelect ? options[f.select] || [] : [];
              const required = isRequired(f, values); // some fields depend on others (origin and brand are not asked of a service)
              return (
                <div key={f.name} className="space-y-1.5">
                  <label htmlFor={id} className="block text-sm font-semibold">
                    {f.label}
                    {required && <span className="ms-1 text-status-danger" aria-hidden="true">*</span>}
                  </label>
                  {isSelect ? (
                    <div className="flex gap-2">
                      <select
                        id={id}
                        value={values[f.name] || ""}
                        onChange={(e) => set(f.name, e.target.value)}
                        required={required}
                        aria-required={required || undefined}
                        className={inputCls}
                      >
                        <option value="">Choose…</option>
                        {opts.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {onRequestNew && !f.noNew && (
                        <button
                          type="button"
                          onClick={() => onRequestNew(f)}
                          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          New
                        </button>
                      )}
                    </div>
                  ) : f.multiline ? (
                    <textarea
                      id={id}
                      rows={3}
                      value={values[f.name] || ""}
                      onChange={(e) => set(f.name, e.target.value)}
                      required={required}
                      aria-required={required || undefined}
                      className={cn(inputCls, "h-auto py-2")}
                    />
                  ) : (
                    <input
                      id={id}
                      type="text"
                      autoComplete="off"
                      value={values[f.name] || ""}
                      onChange={(e) => set(f.name, e.target.value)}
                      required={required}
                      aria-required={required || undefined}
                      className={inputCls}
                    />
                  )}
                </div>
              );
            })}

            {error && (
              <p role="alert" className="rounded-lg bg-status-danger-soft px-3 py-2 text-sm font-semibold text-status-danger">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close className="h-10 rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={busy}
                className="erp-btn-primary disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
