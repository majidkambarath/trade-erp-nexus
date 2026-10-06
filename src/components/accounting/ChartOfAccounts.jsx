import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, FolderPlus, Link2, Lock, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { drCr, formatNumber, formatDateGB, todayInput } from "../../utils/format";
import { banking } from "../../lib/bankingApi";
import { isValidIban } from "../../lib/iban";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import AttachmentPanel, { linkPending } from "./AttachmentPanel";
import PartyForm from "../parties/PartyForm";
import { partyMaster } from "../../lib/partyMasterApi";
import { emptyParty, fieldForServerError, firstSectionWithErrors, formToPayload, partyToForm, validateParty } from "../../lib/partyForms";
import { Balance, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Select, SearchSelect, Spinner, TextInput, Textarea, errorMessage, useAsync, useToasts, DateInput } from "./kit";
import { useMediaQuery } from "./DataTable";
import DocumentAuditTrail, { VoucherAuditTrail } from "../audit/AuditTrail";

const SM = "(min-width: 640px)";

const CATEGORY_LABEL = { ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses" };
const CATEGORY_TONE = { ASSET: "teal", LIABILITY: "plum", EQUITY: "neutral", INCOME: "olive", EXPENSE: "rose" };
// Which side a balance of this category normally sits on, shown beside the amount.
const NORMAL_SIDE = { ASSET: "Dr", EXPENSE: "Dr", LIABILITY: "Cr", EQUITY: "Cr", INCOME: "Cr" };

const money = (n) => formatNumber(n, 2);
const balanceText = (net) => { const { text, side } = drCr(net); return side ? `${text} ${side}` : text; };

// Every group, depth-first, with its depth, for pickers.
export function flattenGroups(chart) {
  const out = [];
  const walk = (nodes, depth, category) =>
    nodes.forEach((g) => {
      out.push({ _id: g._id, name: g.name, prefix: g.prefix, category, depth, role: g.role || "other" });
      walk(g.children, depth + 1, category);
    });
  chart?.categories?.forEach((c) => walk(c.groups, 0, c.category));
  return out;
}

const matches = (a, q) => !q || `${a.accountCode} ${a.accountName}`.toLowerCase().includes(q);

// Keep a group if it, a descendant or one of its accounts matches the search.
function filterGroup(g, q, showInactive) {
  const accounts = g.accounts.filter((a) => (showInactive || a.isActive) && matches(a, q));
  const children = g.children.map((c) => filterGroup(c, q, showInactive)).filter(Boolean);
  const nameHit = q && g.name.toLowerCase().includes(q);
  if (!accounts.length && !children.length && !nameHit && q) return null;
  return { ...g, accounts: nameHit ? g.accounts.filter((a) => showInactive || a.isActive) : accounts, children };
}

export default function ChartOfAccounts() {
  const { data: chart, loading, error, reload } = useAsync(() => accounting.chart(), []);
  const { notify, toastNode } = useToasts();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [accountModal, setAccountModal] = useState(null); // { account?, groupId? }
  const [groupModal, setGroupModal] = useState(null); // { group? }
  const [ledgerFor, setLedgerFor] = useState(null);

  const q = search.trim().toLowerCase();
  const groups = useMemo(() => flattenGroups(chart), [chart]);
  const toggle = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  // Adds back any default group or account that is missing; never changes or removes anything.
  const [restoring, setRestoring] = useState(false);
  async function restoreDefaults() {
    setRestoring(true);
    try {
      const made = await accounting.restoreDefaults();
      notify(made.groups || made.accounts ? `Restored ${made.groups} group(s) and ${made.accounts} account(s)` : "Every default account is already there");
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setRestoring(false);
    }
  }

  const saved = (msg) => {
    notify(msg);
    reload();
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Chart of accounts"
        description="Every ledger account, grouped by what it is. Balances come from the same ledger as the Trial Balance. Account codes are assigned automatically from the group."
        actions={
          <>
            <Button variant="ghost" onClick={restoreDefaults} disabled={restoring}><RotateCcw className="h-4 w-4" aria-hidden="true" />{restoring ? "Restoring…" : "Restore default accounts"}</Button>
            <Button variant="outline" onClick={() => setGroupModal({})}><FolderPlus className="h-4 w-4" aria-hidden="true" />New group</Button>
            <Button onClick={() => setAccountModal({})}><Plus className="h-4 w-4" aria-hidden="true" />New account</Button>
          </>
        }
      />

      {chart && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {chart.categories.map((c) => (
            <StatCard key={c.category} title={CATEGORY_LABEL[c.category]} count={balanceText(c.net)} tone={CATEGORY_TONE[c.category]} subText={`${NORMAL_SIDE[c.category]} normally · AED`} />
          ))}
        </div>
      )}

      <Panel
        bodyClassName="p-0"
        title={chart ? `${chart.counts.accounts} accounts in ${chart.counts.groups} groups` : "Accounts"}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or name"
                aria-label="Search accounts"
                className="h-9 w-56 rounded-full border border-input bg-background ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
              Show inactive
            </label>
          </>
        }
      >
        {loading && !chart && <Spinner label="Loading the chart of accounts" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {chart && chart.counts.accounts === 0 && chart.counts.groups === 0 && (
          <EmptyState title="No accounts yet" text="Start from the default chart (assets, liabilities, equity, income and expenses), or create your own first group." action={<div className="flex gap-2"><Button onClick={restoreDefaults} disabled={restoring}>Create the default chart</Button><Button variant="outline" onClick={() => setGroupModal({})}>Create a group</Button></div>} />
        )}

        {chart?.categories?.map((cat) => {
          const filtered = cat.groups.map((g) => filterGroup(g, q, showInactive)).filter(Boolean);
          const loose = cat.ungrouped.filter((a) => (showInactive || a.isActive) && matches(a, q));
          if (!filtered.length && !loose.length) return null;
          const open = !collapsed[cat.category];
          return (
            <div key={cat.category} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => toggle(cat.category)} aria-expanded={open} className="flex w-full items-center gap-2 bg-secondary/60 px-5 py-2.5 text-start text-sm font-semibold text-foreground hover:bg-secondary">
                {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                {CATEGORY_LABEL[cat.category]}
                <Balance net={cat.net} className="ms-auto" />
              </button>
              {open && (
                <div>
                  {filtered.map((g) => (
                    <GroupRows key={g._id} group={g} depth={0} collapsed={collapsed} toggle={toggle} forceOpen={Boolean(q)}
                      onAddAccount={(groupId) => setAccountModal({ groupId })} onEditGroup={(group) => setGroupModal({ group })}
                      onEditAccount={(account) => setAccountModal({ account })} onLedger={setLedgerFor} />
                  ))}
                  {loose.length > 0 && (
                    <div className="px-5 py-2">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not in a group</p>
                      {loose.map((a) => <AccountRow key={a._id} account={a} depth={0} category={cat.category} onEdit={() => setAccountModal({ account: a })} onLedger={() => setLedgerFor(a)} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Panel>

      {accountModal && (
        <AccountModal
          groups={groups} {...accountModal} onClose={() => setAccountModal(null)}
          onSaved={(msg) => { setAccountModal(null); saved(msg); }} onError={(m) => notify(m, "error")}
        />
      )}
      {groupModal && (
        <GroupModal groups={groups} {...groupModal} onClose={() => setGroupModal(null)} onSaved={(msg) => { setGroupModal(null); saved(msg); }} />
      )}
      {ledgerFor && <LedgerModal account={ledgerFor} onClose={() => setLedgerFor(null)} />}
      {toastNode}
    </div>
  );
}

function GroupRows({ group, depth, collapsed, toggle, forceOpen, onAddAccount, onEditGroup, onEditAccount, onLedger }) {
  const open = forceOpen || !collapsed[group._id];
  return (
    <div>
      <div
        className="group flex items-center gap-2 border-t border-border/70 pe-3 py-2 sm:pe-5"
        style={{ paddingInlineStart: `calc(var(--tree-pad) + ${depth} * var(--tree-step))` }}
      >
        <button type="button" onClick={() => toggle(group._id)} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${group.name}`} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent">
          {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
        </button>
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{group.name}</span>
        <span className="hidden shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground sm:inline">{group.prefix}</span>
        <span className="ms-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onAddAccount(group._id)} aria-label={`Add account to ${group.name}`} className="grid h-9 w-9 place-items-center lg:h-7 lg:w-7 rounded-full text-muted-foreground opacity-70 hover:bg-accent hover:opacity-100"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>
          <button type="button" onClick={() => onEditGroup(group)} aria-label={`Edit group ${group.name}`} className="grid h-9 w-9 place-items-center lg:h-7 lg:w-7 rounded-full text-muted-foreground opacity-70 hover:bg-accent hover:opacity-100"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
          <Balance net={group.net} className="shrink-0 text-end text-sm font-semibold text-foreground sm:w-36" />
        </span>
      </div>
      {open && (
        <>
          {group.accounts.map((a) => <AccountRow key={a._id} account={a} depth={depth + 1} category={group.category} onEdit={() => onEditAccount({ ...a, groupId: group._id })} onLedger={() => onLedger(a)} />)}
          {group.children.map((c) => (
            <GroupRows key={c._id} group={c} depth={depth + 1} collapsed={collapsed} toggle={toggle} forceOpen={forceOpen}
              onAddAccount={onAddAccount} onEditGroup={onEditGroup} onEditAccount={onEditAccount} onLedger={onLedger} />
          ))}
        </>
      )}
    </div>
  );
}

function AccountRow({ account, depth, onEdit, onLedger }) {
  // SM is 640px: the width at which the code earns a column of its own.
  const wide = useMediaQuery(SM);
  return (
    <div
      className="flex items-center gap-2 border-t border-border/50 py-1.5 pe-3 text-sm hover:bg-accent/50 sm:gap-3 sm:pe-5"
      style={{ paddingInlineStart: `calc(var(--tree-pad) + ${depth} * var(--tree-step) + var(--tree-leaf))` }}
    >
      {/* On a phone the code sits under the name rather than claiming a column of its own.
          One or the other is rendered, never both: two copies of the code in the DOM is two
          things for a screen reader to read and two matches for anything looking it up. */}
      {wide && <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{account.accountCode}</span>}
      <span className="min-w-0 flex-1">
        <span className={account.isActive ? "block truncate text-foreground" : "block truncate text-muted-foreground line-through"}>{account.accountName}</span>
        {!wide && <span className="block font-mono text-[11px] text-muted-foreground">{account.accountCode}</span>}
      </span>
      <span className="hidden items-center gap-1.5 sm:flex">
        {account.isMapped && <Pill tone="info"><Link2 className="h-3 w-3" aria-hidden="true" />Posting</Pill>}
        {account.isSystemAccount && <Pill><Lock className="h-3 w-3" aria-hidden="true" />Default</Pill>}
        {!account.isActive && <Pill tone="warning">Inactive</Pill>}
        {account.documents > 0 && <Pill>{account.documents} file{account.documents > 1 ? "s" : ""}</Pill>}
      </span>
      <Balance net={account.net} className="shrink-0 text-end text-foreground sm:w-36" />
      <span className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onLedger} aria-label={`Ledger of ${account.accountName}`} className="grid h-9 w-9 place-items-center lg:h-7 lg:w-7 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" /></button>
        <button type="button" onClick={onEdit} aria-label={`Edit ${account.accountName}`} className="grid h-9 w-9 place-items-center lg:h-7 lg:w-7 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
      </span>
    </div>
  );
}

// ---------- account form ----------

// What the form asks for follows the group's role (from the posting map, inherited by sub-groups):
//   bank                 bank details (the bank master, account number, IBAN...)
//   receivable | payable the customer / vendor record: basic details, VAT, credit limit and terms,
//                        contacts, bank accounts and KYC documents. The account is "Customer - <name>"
//   anything else        the basics only
// Editing a customer or vendor account shows the same sections, filled from the party record.
export function AccountModal({ account, groupId, groups, onClose, onSaved, onError }) {
  const editing = Boolean(account);
  const [form, setForm] = useState({
    groupId: account?.groupId || groupId || "",
    accountName: account?.accountName || "",
    description: account?.description || "",
    openingBalance: "",
    openingSide: "debit",
    openingDate: todayInput(),
    allowDirectPosting: account?.allowDirectPosting ?? true,
    isActive: account?.isActive ?? true,
    bankId: account?.bank?.bankId || "", accountNumber: account?.bank?.accountNumber || "", iban: account?.bank?.iban || "",
    branchCode: account?.bank?.branchCode || "", accountHolder: account?.bank?.accountHolder || "",
  });
  const banks = useAsync(() => banking.banks({ active: "true" }), []);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const group = groups.find((g) => g._id === form.groupId);
  const role = group?.role || "other";
  const isBank = role === "bank";
  const partyKind = role === "receivable" ? "customer" : role === "payable" ? "vendor" : null;

  // the customer / vendor fields: new ones start empty; an existing account's come from its party record
  const [partyState, setPartyState] = useState(null); // { kind, fields }
  const [partySection, setPartySection] = useState("basic");
  const [submitted, setSubmitted] = useState(false); // after the first try, mistakes show and clear as they are fixed
  const [serverErrors, setServerErrors] = useState({});
  const types = useAsync(() => (partyKind ? partyMaster.documentTypes.list({ active: "true" }) : Promise.resolve([])), [Boolean(partyKind)]);
  const saved = useAsync(() => (editing && partyKind ? partyMaster.accountParty.get(account._id) : Promise.resolve(null)), [account?._id, partyKind]);
  useEffect(() => {
    if (editing && saved.data?.party && saved.data.kind === partyKind) setPartyState({ kind: partyKind, fields: partyToForm(partyKind, saved.data.party) });
  }, [editing, partyKind, saved.data]);
  const loadingParty = Boolean(editing && partyKind && saved.loading);
  const partyFailed = Boolean(editing && partyKind && saved.error); // without the record, saving would treat it as an ordinary account
  const party = partyKind && partyState?.kind === partyKind ? partyState.fields : partyKind && !editing ? emptyParty(partyKind) : null;
  const documentTypes = types.data || [];
  const partyErrors = useMemo(
    () => (party && submitted ? validateParty(partyKind, party, { documentTypes: types.data || [] }) : {}),
    [party, submitted, partyKind, types.data]
  );
  const changeParty = (fields) => {
    setPartyState({ kind: partyKind, fields });
    if (Object.keys(serverErrors).length) setServerErrors({});
  };
  // an existing customer / vendor account can only move to another group of its own kind
  const groupChoices = editing && party ? groups.filter((g) => g.role === role) : groups;
  const noun = partyKind === "vendor" ? "vendor" : "customer";

  const selectedBank = (banks.data || []).find((b) => b._id === form.bankId);
  const bankBody = () => ({ bank: { bankId: form.bankId || null, accountNumber: form.accountNumber.trim(), iban: form.iban.trim(), branchCode: form.branchCode.trim(), accountHolder: form.accountHolder.trim() } });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function validate() {
    const e = {};
    if (!form.groupId) e.groupId = "Choose the group this account belongs to";
    if (!party && !form.accountName.trim()) e.accountName = "Give the account a name";
    const ob = Number(form.openingBalance || 0);
    if (!editing && form.openingBalance !== "" && (!Number.isFinite(ob) || ob < 0)) e.openingBalance = "Enter an amount of zero or more";
    if (isBank && form.iban.trim() && !isValidIban(form.iban)) e.iban = "That IBAN is not valid. Check it for a typing mistake.";
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setSubmitted(true);
    const pe = party ? validateParty(partyKind, party, { documentTypes }) : {};
    if (Object.keys(pe).length) setPartySection(firstSectionWithErrors(pe));
    if (Object.keys(e).length || Object.keys(pe).length) return;
    setBusy(true);
    try {
      if (party) {
        const own = { groupId: form.groupId, description: form.description, allowDirectPosting: form.allowDirectPosting };
        if (editing) {
          await partyMaster.accountParty.update(account._id, { party: formToPayload(partyKind, party), ...own, isActive: form.isActive });
          onSaved(`${account.accountCode} updated`);
        } else {
          const made = await partyMaster.accountParty.create({
            party: formToPayload(partyKind, party), ...own,
            ...(Number(form.openingBalance) > 0 ? { openingBalance: Number(form.openingBalance), openingSide: form.openingSide, openingDate: form.openingDate } : {}),
          });
          onSaved(`${made.account.accountCode} ${made.account.accountName} created`);
        }
      } else if (editing) {
        await accounting.updateAccount(account._id, {
          accountName: form.accountName, description: form.description, groupId: form.groupId,
          allowDirectPosting: form.allowDirectPosting, isActive: form.isActive,
          ...(isBank ? bankBody() : {}),
        });
        onSaved(`${account.accountCode} updated`);
      } else {
        const created = await accounting.createAccount({
          groupId: form.groupId, accountName: form.accountName, description: form.description,
          allowDirectPosting: form.allowDirectPosting,
          ...(isBank ? bankBody() : {}),
          ...(Number(form.openingBalance) > 0 ? { openingBalance: Number(form.openingBalance), openingSide: form.openingSide, openingDate: form.openingDate } : {}),
        });
        const failed = files.length ? await linkPending(files, "account", created._id) : [];
        onSaved(failed.length ? `${created.accountCode} created, but ${failed.length} file(s) could not be attached` : `${created.accountCode} ${created.accountName} created`);
      }
    } catch (err) {
      const field = { DUPLICATE_ACCOUNT: "accountName", OPENING_SIDE_REQUIRED: "openingBalance", GROUP_REQUIRED: "groupId", PARTY_GROUP_REQUIRED: "groupId", INVALID_IBAN: "iban", INVALID_ACCOUNT_NUMBER: "accountNumber" }[err.code];
      const partyField = party ? fieldForServerError(err) : null;
      if (partyField) {
        setServerErrors({ [partyField]: errorMessage(err) });
        setPartySection(firstSectionWithErrors({ [partyField]: true }));
      } else if (field) setErrors({ [field]: errorMessage(err) });
      else onError?.(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      size={party || loadingParty ? "xl" : "lg"} onClose={onClose} title={editing ? `Edit ${account.accountCode}` : "New account"}
      description={editing ? account.accountName : partyKind ? `Creates the ${noun} and its ledger account. The code is assigned automatically when you save.` : "The code is assigned automatically when you save."}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="account-form" disabled={busy || loadingParty || partyFailed}>{busy ? "Saving…" : editing ? "Save changes" : party ? `Create ${noun}` : "Create account"}</Button>
        </>
      }
    >
      <form id="account-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Group" required error={errors.groupId} hint={group ? (partyKind ? `Code will start with ${group.prefix}. The account is named "${partyKind === "vendor" ? "Vendor" : "Customer"} - <name>".` : `Code will start with ${group.prefix}`) : undefined} className="sm:col-span-2">
          <SearchSelect
            value={form.groupId} onChange={(v) => setForm((f) => ({ ...f, groupId: v }))} autoFocus={!editing}
            options={groupChoices.map((g) => ({ value: g._id, label: g.name, hint: CATEGORY_LABEL[g.category], depth: g.depth, searchText: g.prefix }))}
            placeholder="Search or choose a group…" noOptionsText="No group matches"
          />
        </Field>

        {loadingParty && <div className="sm:col-span-2"><Spinner label={`Loading the ${noun}'s details`} /></div>}
        {partyFailed && <div className="sm:col-span-2"><ErrorNote error={saved.error} onRetry={saved.reload} /></div>}
        {party ? (
          <div className="sm:col-span-2">
            <PartyForm
              kind={partyKind} value={party} onChange={changeParty} errors={{ ...partyErrors, ...serverErrors }}
              section={partySection} onSection={setPartySection} autoFocus={false}
              banks={banks.data || []} banksLoading={banks.loading} documentTypes={documentTypes} typesLoading={types.loading}
            />
          </div>
        ) : (
          !loadingParty && !partyFailed && (
            <Field label="Account name" required error={errors.accountName} className="sm:col-span-2">
              <TextInput value={form.accountName} onChange={set("accountName")} maxLength={100} placeholder="e.g. Emirates NBD current account" data-autofocus={editing ? true : undefined} />
            </Field>
          )
        )}
        <Field label="Description" className="sm:col-span-2" hint="Optional. Shown to anyone choosing this account.">
          <Textarea value={form.description} onChange={set("description")} maxLength={500} />
        </Field>

        {isBank && (
          <fieldset className="grid gap-4 rounded-xl border border-border p-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium text-foreground">Bank details <span className="font-normal text-muted-foreground">(optional)</span></legend>
            <Field label="Bank" className="sm:col-span-2">
              <SearchSelect value={form.bankId} onChange={(v) => setForm((f) => ({ ...f, bankId: v }))} clearable loading={banks.loading}
                options={(banks.data || []).map((b) => ({ value: b._id, label: b.bankName, hint: b.bankCode }))} placeholder="Search the bank master…" noOptionsText="No bank yet. Add one under Banks." />
            </Field>
            <Field label="Account number" error={errors.accountNumber}><TextInput value={form.accountNumber} onChange={set("accountNumber")} maxLength={34} /></Field>
            <Field label="IBAN" error={errors.iban} hint="Checked for typing mistakes."><TextInput value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value.toUpperCase() }))} maxLength={40} placeholder="AE07 0331 2345 6789 0123 456" /></Field>
            <Field label="Branch code"><TextInput value={form.branchCode} onChange={set("branchCode")} maxLength={20} /></Field>
            <Field label="Account holder"><TextInput value={form.accountHolder} onChange={set("accountHolder")} maxLength={150} /></Field>
            <Field label="SWIFT / BIC" hint="From the bank master."><TextInput value={selectedBank?.swiftCode || ""} readOnly disabled placeholder={form.bankId ? "Not set for this bank" : "Choose a bank"} /></Field>
          </fieldset>
        )}

        {!editing && (
          <fieldset className="grid gap-4 rounded-xl border border-border p-4 sm:col-span-2 sm:grid-cols-3">
            <legend className="px-1 text-sm font-medium text-foreground">Opening balance <span className="font-normal text-muted-foreground">(optional)</span></legend>
            <Field label="Amount (AED)" error={errors.openingBalance}>
              <TextInput inputMode="decimal" type="number" min="0" step="0.01" value={form.openingBalance} onChange={set("openingBalance")} placeholder="0.00" />
            </Field>
            <Field label="Side">
              <Select value={form.openingSide} onChange={set("openingSide")}>
                <option value="debit">Debit (Dr)</option>
                <option value="credit">Credit (Cr)</option>
              </Select>
            </Field>
            <Field label="As at">
              <DateInput value={form.openingDate} onChange={set("openingDate")} />
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-3">Posted against Opening Balance Equity so the Trial Balance stays balanced.</p>
          </fieldset>
        )}

        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" checked={form.allowDirectPosting} onChange={set("allowDirectPosting")} className="h-4 w-4 accent-[var(--color-primary)]" />
          Allow vouchers to post to this account directly
        </label>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input type="checkbox" checked={form.isActive} onChange={set("isActive")} className="h-4 w-4 accent-[var(--color-primary)]" />
            Active <span className="text-muted-foreground">(an account with a balance, or used by the posting configuration, cannot be deactivated)</span>
          </label>
        )}

        {/* a customer's or vendor's files are its KYC documents, in the sections above */}
        {!party && !loadingParty && !partyFailed && (
          <div className="sm:col-span-2">
            {editing
              ? <AttachmentPanel ownerType="account" ownerId={account._id} label="Documents" />
              : <AttachmentPanel value={files} onChange={setFiles} label="Documents" />}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ---------- group form ----------

export function GroupModal({ group, groups, onClose, onSaved }) {
  const editing = Boolean(group);
  const [form, setForm] = useState({
    name: group?.name || "", prefix: group?.prefix || "", category: group?.category || "ASSET", parentGroup: group?.parentGroup || "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === "prefix" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) : e.target.value }));
  const parents = groups.filter((g) => g.category === form.category && g._id !== group?._id);

  async function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (!form.name.trim()) e.name = "Give the group a name";
    if (!form.prefix) e.prefix = "Enter a short code of 1-5 letters or digits";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body = { name: form.name, prefix: form.prefix, category: form.category, parentGroup: form.parentGroup || null };
      if (editing) await accounting.updateGroup(group._id, body); else await accounting.createGroup(body);
      onSaved(editing ? `${form.name} updated` : `${form.name} created`);
    } catch (err) {
      if (/duplicate|already/i.test(err.message) || err.status === 409) setErrors({ prefix: "That name or code is already used by another group" });
      else setTopError(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md" onClose={onClose} title={editing ? `Edit group ${group.name}` : "New group"}
      description="A group says what kind of account something is, and decides how its balance is read."
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="group-form" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create group"}</Button></>}
    >
      <form id="group-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {topError && <div className="sm:col-span-2"><ErrorNote error={topError} /></div>}
        <Field label="Group name" required error={errors.name} className="sm:col-span-2">
          <TextInput value={form.name} onChange={set("name")} maxLength={60} data-autofocus placeholder="e.g. Bank" />
        </Field>
        <Field label="Code prefix" required error={errors.prefix} hint="Account codes in this group start with it (BANK0001).">
          <TextInput value={form.prefix} onChange={set("prefix")} placeholder="BANK" disabled={editing && group.accounts?.length > 0} />
        </Field>
        <Field label="Category" required hint={editing ? "Moving an account with postings to another category is not allowed." : "Asset, liability, equity, income or expense."}>
          <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, parentGroup: "" }))}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Inside" className="sm:col-span-2" hint="Optional. Nest this group under another group of the same category.">
          <SearchSelect
            value={form.parentGroup || ""} onChange={(v) => setForm((f) => ({ ...f, parentGroup: v }))} clearable
            options={parents.map((g) => ({ value: g._id, label: g.name, depth: g.depth, searchText: g.prefix }))}
            placeholder="Top level" noOptionsText="No group matches"
          />
        </Field>
      </form>
    </Modal>
  );
}

// ---------- account ledger ----------

// The ledger of one account: opening balance, every posting with its running balance and side,
// closing balance. Used in the chart's pop-up and on the Ledger page.
export function LedgerBody({ account }) {
  const [range, setRange] = useState({ from: "", to: "" });
  // the posting whose source document's audit trail is open, or null
  const [audit, setAudit] = useState(null);
  const { data, loading, error, reload } = useAsync(
    () => accounting.accountLedger(account._id, { from: range.from || undefined, to: range.to || undefined }),
    [account._id, range.from, range.to]
  );
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="From"><DateInput value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
        <Field label="To"><DateInput value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
        {(range.from || range.to) && <Button variant="ghost" size="sm" onClick={() => setRange({ from: "", to: "" })}>Clear dates</Button>}
      </div>
      {loading && !data && <Spinner label="Loading the ledger" />}
      <ErrorNote error={error} onRetry={reload} />
      {data && (
        <div className="erp-scroll table-pin-first overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Voucher</th><th className="px-3 py-2 text-start">Narration</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-3 py-2 text-end">Balance</th></tr>
            </thead>
            <tbody>
              <tr className="border-t border-border bg-secondary/30 font-medium"><td className="px-3 py-2" colSpan={5}>Opening balance</td><td className="px-3 py-2 text-end"><Balance net={data.openingNet} /></td></tr>
              {data.rows.length === 0 && <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>No postings in this period.</td></tr>}
              {data.rows.map((r) => (
                <tr key={r._id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2">{formatDateGB(r.date)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                    {r.voucherId ? (
                      <button type="button" onClick={() => setAudit(r)} title={`Audit trail of ${r.voucherNo}`} className="rounded underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {r.voucherNo}
                      </button>
                    ) : r.voucherNo}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.narration}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{r.debit ? money(r.debit) : ""}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{r.credit ? money(r.credit) : ""}</td>
                  <td className="px-3 py-2 text-end font-medium"><Balance net={r.net} /></td>
                </tr>
              ))}
              <tr className="border-t border-border bg-secondary/30 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Closing balance</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(data.totals.debit)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(data.totals.credit)}</td>
                <td className="px-3 py-2 text-end"><Balance net={data.closingNet} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {audit && <SourceAuditTrail row={audit} onClose={() => setAudit(null)} />}
    </>
  );
}

// A posting's source is either a trade document (the four order types post under their own type)
// or a finance voucher; each has its own audit trail.
const DOCUMENT_TYPES = ["purchase_order", "sales_order", "purchase_return", "sales_return"];
function SourceAuditTrail({ row, onClose }) {
  return DOCUMENT_TYPES.includes(row.voucherType)
    ? <DocumentAuditTrail id={row.voucherId} documentNo={row.voucherNo} onClose={onClose} />
    : <VoucherAuditTrail id={row.voucherId} voucherNo={row.voucherNo} onClose={onClose} />;
}

export function LedgerModal({ account, onClose }) {
  return (
    <Modal size="xl" onClose={onClose} title={`${account.accountCode} · ${account.accountName}`} description="Every posting to this account, with a running balance.">
      <LedgerBody account={account} />
    </Modal>
  );
}
