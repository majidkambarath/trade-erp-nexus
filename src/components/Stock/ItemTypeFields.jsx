import React, { useMemo } from "react";
import { Briefcase, Package } from "lucide-react";
import { Field, SearchSelect, useAsync } from "../accounting/kit";
import { accounting } from "../../lib/accountingApi";
import { accountOption } from "../../lib/voucherForms";
import { GOODS, ITEM_TYPES, SERVICE } from "../../lib/itemTypes";
import { cn } from "../../lib/utils";

// The two pieces of the item form that exist because of services: the Goods / Service choice at the top, and the
// two optional accounts a service may name. The rules (what a service hides, what it sends) are in lib/itemTypes.js.

const ICON = { [GOODS]: Package, [SERVICE]: Briefcase };

// A two-way choice, not a dropdown: it decides what the rest of the form asks for, so it should be seen.
export function ItemTypeToggle({ value = GOODS, onChange, disabled = false }) {
  return (
    <div role="radiogroup" aria-label="Item type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ITEM_TYPES.map((t) => {
        const on = value === t.value;
        const Icon = ICON[t.value];
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange?.(t.value)}
            className={cn(
              "flex min-h-11 items-start gap-3 rounded-xl border px-4 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
              on ? "border-primary bg-primary/10 text-foreground" : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-xs font-normal opacity-80">{t.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Income account for what is sold, expense account for what is bought. Both optional: left empty, a sale goes to
// Sales revenue and a purchase to the company's service-expense account.
export function ServiceAccountFields({ incomeAccountId = "", expenseAccountId = "", onChange }) {
  const chart = useAsync(() => accounting.postableAccounts(), []);
  const { income, expense } = useMemo(() => {
    const accounts = chart.data || [];
    return {
      income: accounts.filter((a) => a.category === "INCOME").map(accountOption),
      expense: accounts.filter((a) => a.category === "EXPENSE").map(accountOption),
    };
  }, [chart.data]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <Field label="Income account" hint="Where sales of this service are recorded. Empty: Sales revenue.">
        <SearchSelect
          value={incomeAccountId}
          onChange={(v) => onChange?.("incomeAccountId", v)}
          options={income}
          loading={chart.loading}
          clearable
          placeholder="Company default (Sales revenue)"
          aria-label="Income account"
        />
      </Field>
      <Field label="Expense account" hint="Where purchases of this service are recorded. Empty: the company's service-expense account.">
        <SearchSelect
          value={expenseAccountId}
          onChange={(v) => onChange?.("expenseAccountId", v)}
          options={expense}
          loading={chart.loading}
          clearable
          placeholder="Company default (Services purchased)"
          aria-label="Expense account"
        />
      </Field>
      {chart.error && <p className="text-xs text-muted-foreground lg:col-span-2">The chart of accounts could not be loaded, so the company defaults apply.</p>}
    </div>
  );
}
