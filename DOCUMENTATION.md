# Trade ERP Nexus (Frontend) – Project Documentation

> **Planned finance/trade features:** see `../trade ERP node/docs/ERP_FEATURE_SPEC.md` (account configuration, costing/COGS, returns, ageing, credit control, e-invoicing).

## 1. Overview
- Name: Trade ERP Nexus (Frontend)
- Stack: React (Vite), React Router, Axios, lucide-react icons, Tailwind-like utility classes
- Purpose: Frontend for ERP modules including Accounts, Financial Vouchers, Sales & Purchase Orders, Inventory & Stock, Vendors, Customers, and Reports.
- Entry Points:
  - `index.html`
  - `src/main.jsx` bootstraps React App
  - `src/App.jsx` root-level application wrapper
  - `src/router/index.jsx` defines routes; `src/components/Layout.jsx` renders the main layout and includes Sidebar

## 2. Project Structure
```
public/
  _redirects
  vite.svg
src/
  assets/
    dirham.svg
    react.svg
  axios/
    axios.js
  components/
    AccountsModule/
      Layouts/
        InvoiceView.jsx
      Purchase/
        PurchaseAccount.jsx
        VendorSelect.jsx
      Sales/
        CustomerSelect.jsx
        SaleAccountsManagement.jsx
      Transaction/
        TransactionsManagement.jsx
      Transactors/
        TransactorsManagement.jsx
    Customer/
      CustomerManagement.jsx
    Dashborad/
      index.jsx
    FinancialModules/
      Contra/
        ContraVoucherManagement.jsx
        ContraVoucherView.jsx
      Expense/
        ExpenseVoucherManagement.jsx
      Journal/
        JournalVoucherManagement.jsx
        JournalVoucherView.jsx
      Payment/
        FormComponents.jsx
        InvoiceSelection.jsx
        PartySelect.jsx
        PaymentInvoiceView.jsx
        PaymentVoucher.jsx
        pdfUtils.jsx
        utils.jsx
      Receipt/
        CustomerSelect.jsx
        InvoiceSelection.jsx
        pdfUtils.jsx
        ReceiptVoucher.jsx
        utils.jsx
    Inventory/
      CategoryManagement.jsx
      InventoryManagement.jsx
    Login/
      Login.jsx
    PurchaseOrder/
      purchase/
        GridView.jsx
        InvoiceView.jsx
        POForm.jsx
        PurchaseOrderPage.jsx
        TableView.jsx
      purchaseReturn/
        GridView.jsx
        InvoiceView.jsx
        POForm.jsx
        PurchaseOrderPage.jsx
        TableView.jsx
      sales/
        __tests__/InvoiceView.test.jsx
        GridView.jsx
        InvoiceView.jsx
        SalesOrderPage.jsx
        SOForm.jsx
        TableView.jsx
      salesReturn/
        GridView.jsx
        InvoiceView.jsx
        SalesOrderPage.jsx
        SOForm.jsx
        TableView.jsx
    Reports/
      VATReportCreate.jsx
    Settings/
      Settings.jsx
    Staff/
      staff.jsx
    Stock/
      StockDetail.jsx
      StockManagement.jsx
    UnitOfMeasure/
      UnitOfMeasure.jsx
    VendorModule/
      VendorManagement.jsx
    Layout.jsx
    NotFound.jsx
    SideBar.jsx
  hooks/
    Vendor/
      ActionButtons.jsx
      InputField.jsx
      useVendorForm.js
  pages/
    dashboardPage.jsx
  router/
    index.jsx
  types/
    purchaseOrder.ts
  utils/
    format.js
    poUtils.js
  App.css
  App.jsx
  index.css
  main.jsx
.eslint.config.js
index.html
package.json
README.md
vite.config.js
vitest.config.js
vitest.setup.js
```

## 3. Routing
Defined in `src/router/index.jsx`.

- Auth:
  - `/` -> Login (`components/Login/Login.jsx`)
- Layout wrapper (`components/Layout.jsx`) encloses authenticated routes:
  - `/dashboard` -> `pages/dashboardPage.jsx`
  - `/vendor-creation` -> `components/VendorModule/VendorManagement.jsx`
  - `/customer-creation` -> `components/Customer/CustomerManagement.jsx`
  - `/stock-item-creation` -> `components/Stock/StockManagement.jsx`
  - `/stock-detail/:id` -> `components/Stock/StockDetail.jsx`
  - `/unit-setup` -> `components/UnitOfMeasure/UnitOfMeasure.jsx`
  - `/staff-records` -> `components/Staff/staff.jsx`
  - `/settings` -> `components/Settings/Settings.jsx`
  - Sales & Purchase:
    - `/purchase-order` -> `components/PurchaseOrder/purchase/PurchaseOrderPage.jsx`
    - `/sales-order` -> `components/PurchaseOrder/sales/SalesOrderPage.jsx`
    - `/purchase-return` -> `components/PurchaseOrder/purchaseReturn/PurchaseOrderPage.jsx`
    - `/sales-return` -> `components/PurchaseOrder/salesReturn/SalesOrderPage.jsx`
  - Inventory:
    - `/inventory` -> `components/Inventory/InventoryManagement.jsx`
    - `/category-management` -> `components/Inventory/CategoryManagement.jsx`
  - Accounts Module:
    - `/debit-accounts` -> `components/AccountsModule/Purchase/PurchaseAccount.jsx`
    - `/credit-accounts` -> `components/AccountsModule/Sales/SaleAccountsManagement.jsx`
    - `/transactions` -> `components/AccountsModule/Transaction/TransactionsManagement.jsx`
    - `/transactors` -> `components/AccountsModule/Transactors/TransactorsManagement.jsx`
  - Financial Modules:
    - `/receipt-voucher` -> `components/FinancialModules/Receipt/ReceiptVoucher.jsx`
    - `/payment-voucher` -> `components/FinancialModules/Payment/PaymentVoucher.jsx`
    - `/journal-voucher` -> `components/FinancialModules/Journal/JournalVoucherManagement.jsx`
    - `/contra-voucher` -> `components/FinancialModules/Contra/ContraVoucherManagement.jsx`
    - `/expense-voucher` -> `components/FinancialModules/Expense/ExpenseVoucherManagement.jsx`
  - Reports:
    - `/vat-reports` -> `components/Reports/VATReportCreate.jsx`
- NotFound:
  - `*` -> `components/NotFound.jsx`

### 3a. Accounting, reports, batches and e-invoicing (newer pages)
Navigation now lives in `src/config/navigation.js` (labelled rail + header tabs + Ctrl+K), not `SideBar.jsx`; the Navigation section below describes the old sidebar.

| Route | Component | Notes |
| --- | --- | --- |
| `/dashboard` | `Dashborad/index.jsx` + `OverviewTab`, `SalesTab`, `InventoryTab`, `ReportsTab`, `helpers.js`, `widgets.jsx` (folder name is misspelled; kept) | "Operations Overview": the bento dashboard (four tabs: Dashboard / Sales / Inventory / Reports, gsap entrance, recharts, theme tokens) fed with real data only, from `GET /dashboard-summary` (`lib/dashboardApi.js`; server `services/reports/dashboardService.js` + `dashboardQueries.js`, which call the profit and loss, cash flow, party balances, ageing, stock valuation / expiry / reorder / sales analysis, VAT return and day book services, or group the same data by month in one query). One part per tab: `/` and `/analytics` load with the Dashboard tab, `/sales`, `/inventory`, `/reports` when their tab is opened; all take `?period=week\|month\|quarter` (or `?month=YYYY-MM`, or `?from=&to=`), compared with the same stretch before. A widget with nothing to show says so inside its own card (no invented numbers, no targets, branches, fleet or emirate data); VAT is "Payable" / "Refundable" with no due date, because nothing records whether the company files monthly or quarterly |
| `/chart-of-accounts` | `components/accounting/ChartOfAccounts.jsx` | Default chart shown from first open (parent/child groups under Assets, Liabilities, Equity, Income, Expenses); accounts with opening balance, ledger drawer, file attachments (`AttachmentPanel.jsx`) |
| `/accounting-setup` | `components/accounting/AccountingSetup.jsx` + `setup/*` | Posting accounts (and the switch that turns ledger posting on), fiscal years, tax codes, audit log. Credit control, return rules and the tax identity moved to Settings > Business rules (`?tab=rules` on the old URL redirects) |
| `/financial-statements` | `Reports/FinancialStatements.jsx` | Trial balance; profit and loss as a statement (revenue - cost of sales = gross profit with margin, other income, operating expenses, net profit); cash flow by source with a reconciliation to the cash and bank ledgers; balance sheet |
| `/ledger-reports` | `Reports/LedgerReports.jsx` | General ledger (opening, debit, credit, closing by group), day book (every voucher, open one to see its debits and credits), journals register, cash and bank book |
| `/party-balances` | `Reports/PartyBalances.jsx` | What customers owe / vendors are owed on a date, credit limit use with a labelled status, overdue, link to the party's account |
| `/vat-reports` | `Reports/VatReturn.jsx` | The FTA VAT return (boxes 1a-14) built live from approved documents by tax treatment, netted for returns and notes, reconciled to the VAT accounts; Documents tab (per-document detail); Saved returns (draft, finalise, mark filed with the FTA reference) |
| `/stock-reports` | `Reports/StockReports.jsx` | Stock valuation (reconciled to the Inventory account), movement, item ledger, sales analysis (actual cost of goods), expiry, slow stock, reorder |
| `/ageing`, `/statement` | `Reports/AgeingReport.jsx`, `Reports/StatementOfAccount.jsx` | Receivable/payable ageing; party statement with server-side running balance |
| `/batches` | `Inventory/BatchManagement.jsx` | Batches with expiry, first-expiry-first-out, write-off |
| `/receipt-voucher`, `/payment-voucher` | `finance/PartyVouchers.jsx` | Party, amount, oldest-first allocation over open invoices (the rest stays on account), then how it was paid: cash, bank, transfer, cheque or card (`PaymentModeFields.jsx`) |
| `/journal-voucher` | `finance/JournalVouchers.jsx` | Rows of account / narration / debit / credit on the chart; posts when debits equal credits; Enter, Up/Down, Alt+N, Alt+Delete, Ctrl+Enter |
| `/contra-voucher`, `/expense-voucher` | `finance/ContraVouchers.jsx`, `finance/ExpenseVouchers.jsx` | Cash/bank transfers; expenses with VAT and a payment mode |
| `/debit-credit-notes` | `finance/DebitCreditNotes.jsx` | Customer or vendor notes with a live "will post" preview; can be set against an open invoice |
| `/cheques`, `/cash-and-bank`, `/ledger` | `banking/ChequeRegister.jsx`, `banking/CashAndBank.jsx`, `accounting/LedgerBook.jsx` | Cheque register (clear / bounce / cancel); cash and bank balances; any account's ledger with running balance and Dr/Cr |
| `/banks`, `/card-types`, `/cards` | `banking/BankMaster.jsx`, `CardTypeMaster.jsx`, `CardMaster.jsx` | Bank, card-type and card masters |
| `/opening-balances` | `accounting/OpeningBalances.jsx` + `accounting/openingBalances/{AccountsStep,PartiesStep,StockStep,parts}.jsx` (steps: Go-live date, Accounts, Customers, Vendors, Stock, Review), `lib/openingBalanceApi.js`, pure form logic `lib/openingBalanceForms.js` | Go-live conversion. Fix the go-live date first, then enter account balances (one balanced voucher; the difference goes to Opening Balance Equity), customer and vendor open invoices (approved documents flagged `isOpening`, no stock or VAT, their own due date, ageing and settleable), and opening stock (quantity and cost per item; weighted average, batches, one ledger voucher). Every step can be reversed until a later movement or settlement uses it; Review shows the opening trial balance and reconciles stock to the Inventory account |
| `/kyc-documents` | `parties/KycDocuments.jsx` | Document-type master (trade licence, Emirates ID...) and the list of customer / vendor documents expiring soon or expired; documents themselves are attached on the party form |
| `/ifrs-statements` | `Reports/IfrsStatements.jsx` | Statement of financial position, profit or loss, changes in equity, cash flows and notes, prepared from the general ledger with a comparative period |
| `/currencies` | `accounting/Currencies.jsx` | Currency master and exchange rates (`lib/currencyApi.js`, `/api/v1/currencies`). AED is the read-only base; a foreign currency must be switched on AND have a rate to appear on a voucher. "Add rate" opens the rate history; the allowed rate tolerance is set on the page |
| `/currency-register` | `accounting/CurrencyRegister.jsx` | Foreign-currency receipts and payments with rate, AED value, totals and average rate per currency and direction; CSV export |

Foreign currency on `/receipt-voucher` and `/payment-voucher` (`finance/PartyVouchers.jsx`, pure logic in `lib/currencyForms.js`): once a foreign currency is on and has a rate, a Currency picker appears. The amount is typed in that currency, the rate is prefilled from `GET /currencies/rate` for the voucher date (refreshed when the currency or date changes) and the AED equivalent is shown live; a typed rate further from the rate on file than the tolerance needs a reason. The allocation grid, invoices and ledger stay in AED. Lists show a currency badge and the foreign amount; the view and printout read "USD 1,000.00 @ 3.6725 = AED 3,672.50". Phase 2 (foreign-currency invoices, realised gain/loss, month-end revaluation) is not built.
| `/e-invoicing` | `EInvoicing/EInvoicing.jsx` | Dashboard, outbound, inbound, readiness, settings. Sandbox provider only; the live service-provider connection is shown as "coming soon" |

Orders (`OrderEntry/OrderForm.jsx`) send line discounts, tax codes, batch/expiry and header charges; the server prices the document. Choosing Approved saves a draft and then approves through `lib/processTransaction.js`, which asks before overriding a credit-control warning. Document numbers are assigned by the server on save.

## 4. Navigation (Sidebar)
- File: `src/components/SideBar.jsx`
- Sections (role: Admin hardcoded):
  - Financial Modules: Receipt, Payment, Journal, Contra, Expense
  - Accounts Module:
    - Debit Accounts (`/debit-accounts`)
    - Credit Accounts (`/credit-accounts`)
    - Transactions (`/transactions`)
    - Transactors (`/transactors`)
  - Vendor Modules: Vendor Creation
  - Customer Modules: Customer Creation
  - Sales & Purchase: Purchase Order, Sales Order, Purchase Return, Sales Return
  - Inventory & Stock: Stock Item Creation, Inventory
  - Unit of Measure: Unit Setup
  - Staff Management: Staff Records
  - Reports: VAT Reports
- Interactive: collapsible sections, active highlighting, animation.

## 5. Accounts Module
### 5.1 Debit Accounts (formerly Purchase Accounts)
- File: `src/components/AccountsModule/Purchase/PurchaseAccount.jsx`
- Manage payables from vendor purchase vouchers and payment vouchers.
- API:
  - Vendors: `GET /vendors/vendors`
- One document's effects and history: `GET /transactions/transactions/:id/audit` -> `{ document, party, ledger, stock, partyBalance, settlements, einvoice, activity }`
- One voucher's effects and history: `GET /vouchers/vouchers/:id/audit` -> `{ voucher, ledger, allocations, onAccount, cheque, activity }`
  - Invoices: `GET /vouchers/vouchers?voucherType=purchase`
  - Vouchers: `GET /vouchers/vouchers?voucherType=payment`
- Features:
  - Filters: vendor, date range, search, pagination, sorting
  - Stats: total invoices/vouchers, totals, paid, balance
  - Views: invoices list, payment vouchers linked to invoices
  - Detail view: `InvoiceView`
  - Add Debit Invoice modal: `VendorSelect` and invoice selection; auto-calculations for debit amount (base), tax, total, paid, balance, status; return amount adjustments
  - Submit Account Voucher: `POST /account/account-vouchers` with payload including party, voucherType (purchase), invoiceIds, voucherIds, transactionNo, date, totals, status, invoiceBalances.
- UI Terminology: "Debit Accounts", "Debit Invoices", "Debit Amount", hint "Debit + Tax - Return".
- Backend contract keys remain (voucherType: `purchase`, base amount key internally `purchaseAmount`).

### 5.2 Credit Accounts (formerly Sales Accounts)
- File: `src/components/AccountsModule/Sales/SaleAccountsManagement.jsx`
- Manage receivables from customer sale vouchers and receipt vouchers.
- API:
  - Customers: `GET /customers/customers`
  - Invoices: `GET /vouchers/vouchers?voucherType=sale`
  - Vouchers: `GET /vouchers/vouchers?voucherType=receipt`
- Features:
  - Filters: customer, date range, search, pagination, sorting
  - Stats: totals, paid, balance
  - Views: sale invoices list, receipts linked to invoices
  - Detail view: `InvoiceView`
  - Add Credit Invoice modal: `CustomerSelect`; auto-calculations for credit amount (base), tax, total, paid, balance, status; return amount adjustments
  - Submit Account Voucher: `POST /account/account-vouchers` payload (partyType Customer, voucherType sale, invoice/voucher linking, totals, statuses).
- UI Terminology: "Credit Accounts", "Credit Invoices", "Credit Amount", hint "Credit + Tax - Return".
- Backend contract keys remain (voucherType: `sale`, base amount key internally `saleAmount`).

### 5.3 Transactions
- File: `src/components/AccountsModule/Transaction/TransactionsManagement.jsx`
- Purpose: List and manage account transactions (standard listing/filters expected).

### 5.4 Transactors
- File: `src/components/AccountsModule/Transactors/TransactorsManagement.jsx`
- Purpose: Manage transactors in the Accounts context.

### 5.5 Shared Layout
- `InvoiceView` (reusable invoice viewing UI) – `src/components/AccountsModule/Layouts/InvoiceView.jsx`.

## 6. Financial Modules
- Receipt Voucher: `src/components/FinancialModules/Receipt/ReceiptVoucher.jsx`
  - Support components: `CustomerSelect.jsx`, `InvoiceSelection.jsx`, `pdfUtils.jsx`, `utils.jsx`
- Payment Voucher: `src/components/FinancialModules/Payment/PaymentVoucher.jsx`
  - Support: `PartySelect.jsx`, `InvoiceSelection.jsx`, `pdfUtils.jsx`, `utils.jsx`, `PaymentInvoiceView.jsx`
- Journal Voucher: `src/components/FinancialModules/Journal/JournalVoucherManagement.jsx`, `JournalVoucherView.jsx`
- Contra Voucher: `src/components/FinancialModules/Contra/ContraVoucherManagement.jsx`, `ContraVoucherView.jsx`
- Expense Voucher: `src/components/FinancialModules/Expense/ExpenseVoucherManagement.jsx`
- Audit trail (every Finance tab): `VoucherAuditTrail` from `components/audit/AuditTrail.jsx`, a read-only modal over `GET /vouchers/vouchers/:id/audit`. It shows the double entry the voucher posted (with totals and whether they balance, and the reversing entries once it is deleted), the invoices it was set against with the balance each moved from and to, anything left on account, its cheque with that cheque's own history, and then every save, edit, approval and deletion with who did it. Reached from the **Receipts, Payments, Journal, Contra, Expenses and Notes** screens through the shared `VoucherView` (`finance/shared.jsx`), from **Cheques** on each row, and from **Ledger** and **Cash & bank** by clicking a posting's voucher number - which opens the document trail for the four order types and the voucher trail for everything else (`LedgerBody` in `accounting/ChartOfAccounts.jsx`, so the same drill-down works wherever `LedgerModal` is used: Chart of accounts, Financial statements, Ledger reports, Cash & bank). A voucher with nothing posted says why (not approved, cancelled, posting off, or the older Transactors format).

## 7. Sales & Purchase Orders
- Purchase Order:
  - `purchase/` -> GridView, InvoiceView, POForm, PurchaseOrderPage, TableView
  - `purchaseReturn/` -> analogous components for returns
- Sales Order:
  - `sales/` -> GridView, InvoiceView, SOForm, SalesOrderPage, TableView
  - `salesReturn/` -> analogous components for returns
- Audit trail (all four modules): the row menu in TableView, a button on the card in GridView and a button on the document screen (`shared/InvoiceScreen.jsx`) open `components/audit/AuditTrail.jsx`, a read-only modal over `GET /transactions/transactions/:id/audit`. It shows, in order, the **financial effect** - the ledger entries the document posted with their totals and whether they balance (and the reversing entries, behind a toggle, once it has been cancelled or deleted), the stock it moved with the costing trail, the party balance row it wrote, the vouchers that settled it and its e-invoice - and then the **audit trail**: every save, edit, approval, rejection, cancellation and deletion, with who did it and the before/after of each. A document with nothing posted says why (not approved yet, posting off, an opening document, or approved but never posted) instead of showing an empty table.
- Tests: `components/PurchaseOrder/sales/__tests__/InvoiceView.test.jsx` and `components/PurchaseOrder/shared/__tests__/AuditTrail.test.jsx` using Vitest.

## 8. Inventory & Stock
- InventoryManagement: `src/components/Inventory/InventoryManagement.jsx`
- CategoryManagement: `src/components/Inventory/CategoryManagement.jsx`
- StockManagement: `src/components/Stock/StockManagement.jsx`
- Changing an item's quantity (the item form, or a movement typed on the Inventory page) is a costed stock event: the server takes it out at the weighted-average cost or puts it in at the cost typed (else the average), takes batches first-expiry-first-out on a decrease, writes **one** movement, and with ledger posting on books Dr Inventory / Cr Stock adjustment (a gain) or the reverse (a loss). It is refused inside a closed fiscal year. Quantities typed on a brand-new item are not posted: use Opening balances > Stock or a purchase.
- StockDetail: `src/components/Stock/StockDetail.jsx`

## 9. Vendors & Customers
- Vendor Management: `src/components/VendorModule/VendorManagement.jsx`
  - Hooks: `src/hooks/Vendor/*`
- Customer Management: `src/components/Customer/CustomerManagement.jsx`
- **Party master data** (`src/components/parties/`): the add / edit dialog of both pages is `PartyModal`, built on `PartyForm`, one form in six tabs - Basic (contact, addresses, status), VAT (status registered / unregistered / exempt / designated zone, 15-digit TRN, trade licence), Credit and terms (credit limit for customers, payment terms and credit days, kept in step), Contacts (one primary), Bank accounts (bank from the bank master, IBAN checksum, SWIFT) and KYC documents (type from the document-type master, number length and expiry rule from the type, issue / expiry dates, file upload, status flag). Rules are in `lib/partyForms.js` (pure, tested); API calls in `lib/partyMasterApi.js` (`/document-types`, `/document-expiry`, `/accounting/accounts/party`). The lists show `ExpiryPill` when a document has expired or is about to. `KycDocuments.jsx` lists expiring documents and maintains the document types (no email reminders yet: shown as "Coming soon").
- **Account form by group**: `AccountModal` in `accounting/ChartOfAccounts.jsx` reads the group's `role` (cash | bank | receivable | payable | creditCard | other, from the posting map, inherited by sub-groups). Bank groups show the bank details; Receivable / Payable groups show the customer / vendor sections instead of "Account name" and create the party and its `Customer - <name>` / `Vendor - <name>` account in the chosen group; other groups ask for the basics only. Editing a customer or vendor account loads the same sections from the party record.

## 10. Reports
All reports are in the Reports module (header tabs: Statements, Ledger, Balances, Ageing, Account statement, Stock, VAT, e-Invoicing). Shared pieces are in `Reports/reportKit.jsx` (`DateRange` with presets, `Frame` for loading/error). The ledger-based ones read `GET /api/v1/accounting/reports/*` (`services/reports/ledgerReportsService.js`); the VAT return reads `/api/v1/vat-return/*` (`services/reports/vatReturnService.js`); stock reports `/api/v1/stock-reports/*`. A report call first makes sure ledger posting is on and earlier approved documents are posted (`DefaultChartService.onOpenThrottled`), so a report is never empty only because nobody opened the chart.

VAT treatment of a line is its tax code's kind (`standard`, `zero_rated`, `exempt`, `out_of_scope`, `reverse_charge`, snapshotted on the line). A line with VAT and no code is standard; a 0% line with no code is "unclassified" and is listed for the user to fix rather than guessed into a box. Boxes 2 (tourist refunds), 6 (imports) and 7 (adjustments) are shown as "Not tracked yet".

## 11. Utilities & Axios
- Axios instance: `src/axios/axios.js`
- Utilities:
  - `src/utils/format.js` – formatting helpers (currency/date/etc.)
  - `src/utils/poUtils.js` – purchase order utilities
- Financial PDFs:
  - `src/components/FinancialModules/Payment/pdfUtils.jsx`
  - `src/components/FinancialModules/Receipt/pdfUtils.jsx`

## 12. Styling & Icons
- Tailwind-like utility classes used throughout JSX.
- Icons: `lucide-react` package for icons.
- Styles: `src/App.css`, `src/index.css`.
- **Typography**: Inter (loaded in `index.html`, weights 400/500/600 only). The interface uses three weights: 400 text, 500 labels and controls, 600 headings, figures and emphasis. `font-semibold`, `font-bold`, `font-extrabold` and `font-black` all resolve to 600 through the `@theme` block in `index.css`, so heavier weights cannot creep back in. Page titles are `text-2xl`; headline figures are at most `text-2xl`. Body letter-spacing is 0, headings -0.011em.
- **Theme**: `components/theme-provider.jsx` keeps a *preference* (`light | dark | system`) and exposes the resolved `theme` (`light | dark`), so `theme === "dark"` checks keep working. `index.css` sets `color-scheme` so native controls follow the theme.

### 12a. Settings, preferences, dates
- `/settings` (`components/Settings/Settings.jsx`) has five tabs, kept in the URL (`?tab=`): **Company** (profile and logo), **Business rules** (`BusinessRules.jsx`: credit control, return rules, tax identity - the tax identity fills itself from the Company tab), **Invoice bank details** (printed on invoices; includes IBAN checksum and SWIFT), **Preferences** (theme, date format, time format - applied at once and remembered in this browser), **Security** (change password). Every control saves something; what is not built (language, notifications) is listed as "Coming soon". Tax codes, document numbering, fiscal years and posting accounts live in Accounting setup. Rules are in `lib/settingsForm.js`.
- **Date fields**: use `DateInput` (kit.jsx), never `<input type="date">`: it shows and accepts the date in the user's chosen format (typed, or from the calendar button) and still reports ISO `YYYY-MM-DD`. `min`/`max` guide the calendar only; the form explains a date outside the range.
- **Dates**: format every date through `utils/format.js` - `formatDate`, `formatTime`, `formatDateTime` (`formatDateGB` is the same function). They follow the Date / Time format preference and show Dubai time. Never call `toLocaleDateString` directly. Native `<input type="date">` is drawn by the browser and cannot follow the preference.

## 13. Configuration & Tooling
- Build: Vite (`vite.config.js`)
- Testing: Vitest (`vitest.config.js`, `vitest.setup.js`)
- Lint: ESLint (`eslint.config.js`)
- SPA redirects: `public/_redirects` for client-side routing on static hosts.

## 14. Recent Terminology Changes
- Per change request:
  - "Purchase Accounts" -> "Debit Accounts"
  - "Sales Accounts" -> "Credit Accounts"
- Updated in:
  - UI texts in `PurchaseAccount.jsx` and `SaleAccountsManagement.jsx`
  - Sidebar labels and routes in `SideBar.jsx`
  - Router paths in `src/router/index.jsx`:
    - `/purchase-accounts` -> `/debit-accounts`
    - `/sales-accounts` -> `/credit-accounts`
- Business logic and backend field names remain unchanged (e.g., voucherType values and base amount keys) to preserve API contracts.

## 15. API Contracts (Frontend Expectations)
- Vendors: `GET /vendors/vendors`
- Customers: `GET /customers/customers`
- Vouchers (paginated): `GET /vouchers/vouchers` with parameters:
  - `voucherType`: `purchase` | `sale` | `payment` | `receipt` | etc.
  - `page`, `limit`
  - `partyId` (optional)
  - `startDate`, `endDate` (optional)
  - `search` (optional)
- Account Vouchers creation: `POST /account/account-vouchers`
  - Common payload fields (Debit/Credit modules):
    - `partyId`, `partyType` ("Vendor"|"Customer")
    - `voucherType` ("purchase"|"sale")
    - `invoiceIds` (array), `voucherIds` (array)
    - `transactionNo`, `date`
    - `totalAmount`, `returnAmount`, `paidAmount`, `balanceAmount`
    - `status` ("Paid"|"Unpaid"|"Partially Paid")
    - `invoiceBalances`: `[{ invoiceId, transactionNo, balanceAmount }]`

## 16. Build, Run, Test
- Install dependencies:
  - `npm install`
- Development server:
  - `npm run dev`
  - Default: http://localhost:5173
- Tests:
  - `npm run test`
- Linting:
  - `npm run lint`
- Production build:
  - `npm run build`
- Preview build:
  - `npm run preview`

## 17. Conventions & Best Practices
- Modular structure by business domain
- Axios instance for consistent API configuration
- React Router for navigation
- Hooks (`useState`, `useEffect`, `useCallback`, `useMemo`) for state and performance
- Pagination and sorting integrated in list UIs
- Reusability:
  - `InvoiceView` and componentized form inputs/selectors
- Sidebar structure and role-based filtering (role placeholder currently "Admin")

## 17b. Touch, responsiveness and installing the app

Two breakpoints, each with a reason:

| Below | What changes | Why |
| --- | --- | --- |
| `lg` (1024px) | the labelled rail gives way to a bottom bar + More sheet | the 88px rail plus a tab row leaves too little width for a dense table |
| `md` (768px) | tables become card rows; entry grids become a card per line | a seven-column table at 390px is unreadable either way you turn it |
| `sm` (640px) | dialogs become bottom sheets | there is no rail or header worth leaving uncovered on a phone |

### The shell

`components/shell/` holds it, and all of it reads `src/config/navigation.js`:

- **`AppRail`** - the pointer rail, `lg` and up.
- **`BottomNav`** - four modules in the thumb zone plus More, below `lg`. Which four comes from
  `mobilePrimary` in `MODULES`; `getMobileNav()` fills a slot from the remaining modules when a
  role cannot see a flagged one, and never pins a `footer` module.
- **`MoreSheet`** - everything that did not fit, one level deep, as a bottom sheet.
- **`ModuleTabs`** - the active module's pages; the strip snap-scrolls with a fade at the edge.
- There is deliberately **no hamburger**: navigation is the bar.

Device insets are `pt-safe` / `pb-safe` utilities (`env(safe-area-inset-*)`), and `index.html`
carries `viewport-fit=cover`, so the shell paints under the notch and the home bar without
putting controls there.

### Lists: `DataTable`

`components/accounting/DataTable.jsx` (re-exported from `kit.jsx`) renders **one** of two
shapes, chosen by a live `matchMedia` match - never both, so a 200-row list builds one tree.
A column says where it belongs on a card through `card`:

| `card` | Where it lands |
| --- | --- |
| `primary` | the headline, top-left |
| `badge` | top-right, for a status pill |
| `title` | the line under the headline |
| `amount` | bottom-right, emphasised |
| `meta` | the muted bottom line; several join with a divider |
| `actions` | a row of controls at the foot, outside the card's own tap target |
| `hidden` | in the table only |
| *(none)* | a labelled line in the card body |

A card's tap target is an overlay behind the content, so a card can hold its own buttons
without nesting a control inside a control. `rowHref` makes it a link, `onRowClick` a button.

Figures that only mean something lined up - a trial balance, a VAT return, an ageing - stay
tables. Those use `TableScroll`, or the `table-pin-first` class on an existing
`overflow-x-auto` wrapper: the first column freezes and the numbers scroll under it.

### Installing it (PWA)

- `public/manifest.webmanifest` - name, icons, colours, and four app shortcuts.
- `public/sw.js` - caches the shell (hashed assets, fonts, icons) and **never** the API. That
  rule is absolute: this is a ledger, and a stale figure is worse than a slow one.
- `src/lib/pwa.js` - registers the worker, holds Chromium's `beforeinstallprompt` for the
  "Install app" item in the account menu, and detects iOS, which has no such event and gets
  instructions instead (`components/shell/InstallApp.jsx`).
- A new version is **offered**, not applied: the worker waits until the person taps Reload, so
  the app never swaps itself out mid-voucher.
- `npm run icons` regenerates the icons from the brand colours (no image library - see
  `scripts/make-icons.mjs`).

**Tokens live in `sessionStorage`**, which does not survive closing the app, so an installed
copy asks for a sign-in on each launch. Moving them is a security decision, not a layout one.

### Checking it

| Command | What it does |
| --- | --- |
| `npm run audit:mobile` | static scan of every screen for the patterns that cannot work at 390px |
| `npm run check:mobile` | renders every route in `navigation.js` at 390 / 820 / 1440 against a stub API, screenshots it, and fails on horizontal overflow or a blank page |
| `npm run check:pwa` | builds, serves, and checks the manifest, icons, worker registration and that no API response was cached |

`check:mobile` writes to `.shots/` (gitignored) and drives its page list from `navigation.js`,
so a new screen is checked without anyone remembering to add it. Its stub API answers from
`scripts/shoot-mobile.mjs`; a page that comes back blank there usually means the stub's shape
has drifted from the server's, not that the page is broken.

## 18. Considerations & Future Improvements
- Role-based access: Sidebar role is hardcoded; integrate with backend auth to control access and visibility.
- Backward compatibility: Update any external deep links to new paths `/debit-accounts` and `/credit-accounts`.
- Consistent terminology: UI adjusted to "Debit/Credit" while backend keys remain as purchase/sale to prevent breaking existing APIs.
- Centralized formatting: Continue using `format.js` for currency/date to maintain a single source of truth.

## 19. How to Export This Documentation to PDF
- Option A (VSCode Markdown):
  1. Open `DOCUMENTATION.md` in VSCode.
  2. Use a Markdown-to-PDF extension (e.g., "Markdown PDF").
  3. Export to PDF.
- Option B (Browser):
  1. Open this file using a Markdown preview or paste into a Google Doc.
  2. File -> Print -> Save as PDF.
- Option C (CLI tools): Use `pandoc` to convert Markdown to PDF: `pandoc DOCUMENTATION.md -o DOCUMENTATION.pdf`.

---

Generated by Qodo after analyzing the project workspace.
