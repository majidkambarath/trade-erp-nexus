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
- Customer's document (public, outside `RequireSession` and `Layout`, its own Suspense):
  - `/d/:token` -> `components/send/SharedDocument.jsx`
- NotFound:
  - `*` -> `components/NotFound.jsx`

### 3a. Accounting, reports, batches and e-invoicing (newer pages)
Navigation now lives in `src/config/navigation.js` (labelled rail + header tabs + Ctrl+K), not `SideBar.jsx`; the Navigation section below describes the old sidebar.

| Route | Component | Notes |
| --- | --- | --- |
| `/dashboard` | `Dashborad/index.jsx` + `OverviewTab`, `SalesTab`, `InventoryTab`, `ReportsTab`, `helpers.js`, `widgets.jsx` (folder name is misspelled; kept) | "Operations Overview": the bento dashboard (four tabs: Dashboard / Sales / Inventory / Reports, gsap entrance, recharts, theme tokens) fed with real data only, from `GET /dashboard-summary` (`lib/dashboardApi.js`; server `services/reports/dashboardService.js` + `dashboardQueries.js`, which call the profit and loss, cash flow, party balances, ageing, stock valuation / expiry / reorder / sales analysis, VAT return and day book services, or group the same data by month in one query). One part per tab: `/` and `/analytics` load with the Dashboard tab, `/sales`, `/inventory`, `/reports` when their tab is opened; all take `?period=week\|month\|quarter` (or `?month=YYYY-MM`, or `?from=&to=`), compared with the same stretch before. A widget with nothing to show says so inside its own card (no invented numbers, no targets, branches, fleet or emirate data); VAT is "Payable" / "Refundable" with no due date, because nothing records whether the company files monthly or quarterly |
| `/chart-of-accounts` | `components/accounting/ChartOfAccounts.jsx` | Default chart shown from first open (parent/child groups under Assets, Liabilities, Equity, Income, Expenses); accounts with opening balance, ledger drawer, file attachments (`AttachmentPanel.jsx`) |
| `/accounting-setup` | `components/accounting/AccountingSetup.jsx` + `setup/*` | Posting accounts (and the switch that turns ledger posting on), fiscal years (Close year / Reopen open `setup/YearEndDialog.jsx`: the checks, the profit that moves to Retained Earnings, what the next year opens with; see `foodERP/CLAUDE.md` "Closing a fiscal year"), tax codes, audit log. Credit control, return rules and the tax identity moved to Settings > Business rules (`?tab=rules` on the old URL redirects) |
| `/financial-statements` | `Reports/FinancialStatements.jsx` | Trial balance; profit and loss as a statement (revenue - cost of sales = gross profit with margin, other income, operating expenses, net profit); cash flow by source with a reconciliation to the cash and bank ledgers; balance sheet |
| `/ledger-reports` | `Reports/LedgerReports.jsx`, `Reports/DayReports.jsx` | General ledger (opening, debit, credit, closing by group), day book (every voucher, open one to see its debits and credits), **Daily summary** (each day's vouchers by kind: count and amount, out-of-balance days flagged, a day opens the day book), journals register, cash and bank book, **Day end** (one day's cash and bank per account: opening, receipts, payments, closing, where the money came from and went to, agrees-with-the-ledger check; previous / next day; the last 14 days day by day). The trial balance and general ledger have an "Include year-end closing entries" box |
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
| `/currencies` | `accounting/Currencies.jsx` | Currency master and exchange rates (`lib/currencyApi.js`, `/api/v1/currencies`). The organisation's base currency (AED for a UAE organisation) is the read-only base; a foreign currency must be switched on AND have a rate to appear on a voucher. "Add rate" opens the rate history; the allowed rate tolerance is set on the page |
| `/currency-register` | `accounting/CurrencyRegister.jsx` | Foreign-currency receipts and payments with rate, base-currency value, totals and average rate per currency and direction; CSV export |

Foreign currency on `/receipt-voucher` and `/payment-voucher` (`finance/PartyVouchers.jsx`, pure logic in `lib/currencyForms.js`): once a foreign currency is on and has a rate, a Currency picker appears. The amount is typed in that currency, the rate is prefilled from `GET /currencies/rate` for the voucher date (refreshed when the currency or date changes) and the AED equivalent is shown live; a typed rate further from the rate on file than the tolerance needs a reason. The allocation grid, invoices and ledger stay in AED. Lists show a currency badge and the foreign amount; the view and printout read "USD 1,000.00 @ 3.6725 = AED 3,672.50". Phase 2 (foreign-currency invoices, realised gain/loss, month-end revaluation) is not built.
| `/e-invoicing` | `EInvoicing/EInvoicing.jsx` | Dashboard, outbound, inbound, readiness, settings. Sandbox provider only; the live service-provider connection is shown as "coming soon" |
| `/quotations` | `salesDocs/QuotationsPage.jsx` (+ `QuotationList`, `QuotationView`) | Offers to customers: list with tiles (out with customers, accepted not ordered, expiring within 7 days, offers won) and status tabs; a document screen with every action; written with the shared order form (`VARIANTS.quotation`). `?open=<id>` opens one |
| `/delivery-notes` | `salesDocs/DeliveryNotesPage.jsx` (+ `DeliveryNoteList`, `DeliveryNoteView`, `DeliveryFromOrder`, `DeliveryDialogs`) | The paper that goes with the goods. List with tiles (delivered not invoiced, past the 14-day window, due within 3 days, on the road); a "Not invoiced" tab where notes of one customer are ticked together for one invoice; a note against a sales order or on its own. `?open=<id>`, `?order=<id>` (a note against that order) and `?status=UNINVOICED` link in |

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

### 7a. Quotations and delivery notes (`components/salesDocs/`)
Neither is a Transaction and neither posts anything. A quotation is an offer; a delivery note is the paper that goes with the goods. **Stock leaves, cost of sales is booked and the receivable is raised only when the sales order that invoices the goods is approved.** Each has its own endpoint (`/quotations`, `/delivery-notes`; `lib/salesDocumentsApi.js`), its own number series (`QT-`, `DLN-`; `DN-` is the debit note) and its own collection, so nothing that reads Transaction (VAT, ageing, the dashboard, e-invoicing) can ever see them.

- **The form is the order form.** `OrderEntry/variants.js` adds `VARIANTS.quotation` and `VARIANTS.deliveryNote`, and `OrderForm` takes a few opt-in hooks from them (`endpoint`, `secondDateKey`, `referenceKey`, `extraFields`, `buildPayload`, `statusOptions: null`, `checkAvailability`); with none set it behaves exactly as before, which the existing order tests cover. The payload carries inputs only (unit `price`, discount, tax code, `charges` always) - the server prices it with the same code that prices the invoice, so an offer and the invoice it becomes agree to the fils.
- **Quotation lifecycle:** Draft -> Sent -> Accepted -> Converted; Rejected; Superseded by a revision. *Expired* is a sent offer past its date, read from the date, never stored. Only a draft is edited; a sent one is **revised** (`QT-2026-0007-R1`, today's rates, valid from today), which supersedes it, and discarding the draft revision brings the original back. "Mark as sent" only records that it has gone: emailing from here is not built, and says so. Converting makes a **draft sales order** (priced afresh on its own date) and spends the offer; if that order is later deleted or rejected the offer goes back to Accepted. A quotation can instead become a delivery note (goods first, invoice after).
- **Delivery note lifecycle:** Draft -> Dispatched ("On the road") -> Delivered (signed for) or Cancelled. *Mark delivered* requires who signed and takes the quantity actually accepted per line (a short line needs a reason); the note is then worth what was accepted, and that is what is invoiced. A note is **against a sales order** (the order's lines, part by part, never more than ordered; `DeliveryFromOrder.jsx`) or **on its own**; several delivered notes of one customer go on one invoice from the *Not invoiced* tab (`POST /delivery-notes/invoice` makes a draft sales order).
- **The 14-day clock.** A tax invoice is due within 14 days of delivery, or - as one summary invoice for a month's deliveries - within 14 days of the month's end. A delivered note not yet invoiced shows where it stands (`lib/salesDocuments.js` `clockText`, from the server's `clock`). Dates are Dubai calendar days.
- **Promised stock.** A note moves nothing, so until it is invoiced the goods are still on hand in the books. The server counts them as *committed*; the form warns when a quantity exceeds what is free (`GET /delivery-notes/availability`), but never blocks.
- **Printing** reuses `InvoiceScreen`: a quotation on `InvoiceSheet` (with its terms and an "Accepted on the terms above" box), a delivery note and a pick list on `DeliverySheet` (no prices unless ticked, a Delivered column once signed for, signature boxes). The pick list shows batches first-expiry-first-out and honours the customer's minimum shelf life, or the batches an approved order already took - a suggestion; the invoice records the batches actually taken. Builders are pure (`salesDocs/documents.js`).
- **Rules live in one place per side.** What a screen may offer comes from the server's `actions`; the form checks that mirror the server's (`validateDeliver`, `validateOrderRows`) are in `lib/salesDocuments.js` and tested without rendering.
- **Linking in:** the sales order list opens narrowed with `/sales-order?search=<number>`; its row menu has *Delivery note* (`/delivery-notes?order=<id>`).
- Tests: `lib/__tests__/salesDocuments.test.js`, `salesDocs/__tests__/documents.test.js`, and the variant payloads in `OrderEntry/__tests__/variants.test.js`. `check:mobile` opens a document from each list and the convert, new and deliver dialogs.

### 7b. The customer's Documents tab (`components/salesDocs/CustomerDocumentsTab.jsx`)
The profile of a customer (`/credit-accounts/customer/:id?tab=documents`, through `PartyAccountPage`; vendors do not have it) shows each **deal** - an offer, the order it became, the deliveries against it and the invoice - as one card with a stepper, instead of four lists the reader has to join. The server does the joining (`GET /document-flow/customer/:id`; `utils/documentFlow.js` on the backend; read only; newest 300 of each kind, and `truncated` says when more exist). `lib/documentFlow.js` decides how a deal reads and what to do next, with no React, so the rules are tested without rendering.

- **Two shapes of deal.** *Order first*: Quotation -> Sales order -> Delivery -> Invoice. *Goods first* (a note raised from an offer, or on its own, then a draft invoice made from it): Quotation -> Delivery -> Invoice, with no separate order step. Every step says where it stands in a word as well as a colour (Done / In hand / Stopped / To do) and links to its document.
- **Next step.** Each deal has one button: Finish and send, Convert to a sales order, Approve the order, Dispatch or Confirm the delivery, **Deliver the rest**, Approve the invoice, Create the invoice. A sent offer waiting on the customer is *In progress*, not *Needs action*. The tab opens on *Needs action* when there is anything, otherwise on *All*.
- **A signed-for note is not a finished delivery.** The server compares the order's lines with what the notes carried (`fulfilment()`), so a part delivery, or a short line, keeps the Delivery step *In hand* with "Still to deliver: 5 x Rice" and offers **Deliver the rest** (`/delivery-notes?order=<id>`, which starts from what is left) - even on an order that has already been invoiced.
- **Close order short.** When all the notes are signed for and part of the order is still to come, the deal also offers **Close order short** next to *Deliver the rest*, for the customer who will never take the rest. The dialog shows the lines that fell short first, asks why (required, kept in the audit trail), and says what will happen: a **draft** order is cut down to what was delivered (so the invoice charges only for those goods, and **Reopen** puts it back until it is approved); an **invoiced** order is left as it is, marked *Closed short*, and the deal then asks for a **sales return** for the undelivered goods (it puts them back in stock and credits the customer) until an approved one exists. A closed order takes no more deliveries and shows a *Closed short* mark in the sales order list.
- **Above the list:** out with the customer, accepted and not ordered, draft invoices to approve, and delivered and not invoiced (with how many are past the 14-day window).
- Tests: `lib/__tests__/documentFlow.test.js` (stepper, next step, groups, part deliveries) and `salesDocs/__tests__/CustomerDocumentsTab.test.jsx`. `check:mobile` opens the tab on a phone.

### 7c. Bank and card reconciliation (`components/banking/BankReconciliation.jsx`, route `/bank-reconciliation`)
Finance → **Reconcile** (also a "Reconcile" link on each bank account of Cash & bank). It brings a bank account's statement and its ledger into agreement line by line and proves they agree as of a date. The page has an account chooser, four figures (balance in the books, lines to do, last reconciled, statement covers up to), and three views: **Statement lines**, **Card settlements**, **History**. `?account=<id>&view=lines|card|history` opens one directly.

**The flow, as a person does it**
1. **Import a statement** (header button). Choose the bank's CSV, Excel or MT940 file. The server reads it and the dialog shows what an import will do: how many lines, how many are already there, the opening and closing balance, whether the running balance chains, and any row it could not read. "How the columns were read" lets you correct the guess (date, description, debit and credit or one signed amount, balance...); the layout is remembered for the next month. The first statement of an account also asks where it starts and the bank's balance the day before.
2. **Set up** (header button) refines that start: tick the older entries the bank had not recorded yet (a cheque not cleared, a deposit not credited). The difference must reach zero.
3. **Work the lines.** The list opens on *Suggested* when there are suggestions: each says why (same amount, same day, a reference or cheque number in the text) and has one **Match** button; **Accept all strong matches** does every high-confidence one. A deposit made of several receipts is suggested as a group. For the rest: **Find in the books** (tick several entries; they must add up to the line exactly), **Post an entry** (bank charge with its VAT, interest, a transfer to another account, a customer receipt or vendor payment, or any account), **Card settlement**, or **Ignore** with a reason. A matched line shows what it matched and can be **Unmatched**; a line in a finished reconciliation is locked.
4. **Finish and prove.** Enter the statement date and closing balance (filled from the latest import). The panel says whether the two sides agree, what is in the way, and shows the reconciliation statement. **Finish reconciliation** numbers it (`BRC-2026-0001`) and locks the matched lines.
5. **History** keeps every reconciliation with its statement (download as CSV) and can reopen the latest one.

**Rules worth knowing**
- A **pending cheque** appears as a match for a statement credit; matching it clears the cheque on that day (the bank has paid it).
- A **matched voucher cannot be edited, deleted or have its cheque bounced** until the line is unmatched (`BANK_MATCHED`), or the reconciliation reopened (`BANK_RECONCILED`).
- **Card settlement** (button on a credit line): tick the card sales the payment settles; the dialog shows what the books expect against what the bank paid, and the difference is split into the VAT on the commission and any commission beyond the booked rate, which must be fully explained before it can be recorded. A difference too large to be commission and VAT, or a payment bigger than the sales, is refused with the reason. The **Card settlements** tab shows card sales still waiting to be paid out (by working days), the settlements, and the commission booked against the commission taken.
- Nothing posts a voucher without a click: suggestions are never applied silently.
- Not built (shown nowhere as a control): bank rules, live bank feeds, PDF statements, CAMT.053, foreign-currency bank accounts, importing the acquirer's own settlement file.
- Tests: `lib/__tests__/bankReconcile.test.js`, `statementFile.test.js`, `components/banking/__tests__/BankReconciliation.test.jsx`. `check:mobile` opens the page, its tabs and seven dialogs at three widths.

### 7d. Sending a document to the customer (`components/send/`, public page `/d/:token`)
An approved sales invoice has a **Send** button on its own screen, as an icon on its row in the sales order list (and in the card view), and as a next step on the customer's deal card ("Send the invoice"). A draft shows no Send at all, and neither do purchase documents. Stage 1 is the **tax invoice only**; quotations, delivery notes and the statement of account follow in Stage 2 and still only print or download.

**The flow, as a person does it**
1. **Send** opens one dialog with two channels, **Email** and **WhatsApp**. The **To** field is filled from the customer's email (then the primary contact) and shows each address as a chip; **Cc** is behind "Add cc"; the subject and message are written for the document and can be edited. A bad address is refused before anything is sent.
2. **Email** attaches the customer copy as a PDF (drawn in the browser, "Customer copy · 1 page · 184 KB" shown) and adds a link to the same document online. A tick removes the PDF. A plain line says anyone with the link can open it and that it stops working after 30 days.
3. **WhatsApp** reads the customer's phone (a UAE number like `050 111 2222` becomes `971501112222`), writes the message with the link and opens WhatsApp with it ready. A person presses send; the history says **Given on WhatsApp**, never "sent".
4. If the server refuses (a wrong address, the service not set up, a duplicate within a minute), the reason is shown **inside the dialog**, which stays open with everything that was typed. A duplicate offers **Send anyway**.
5. The invoice then reads **Emailed 8 Oct** (list, card, header), and **Opened by customer** once the customer's page has really loaded. **Send history** on the invoice shows every attempt with who sent it, to whom and when, and has **Withdraw link** for a wrong-address send.

**The customer's page** (`/d/:token`, `SharedDocument.jsx`): the invoice on the white paper pane, Download PDF and Print, one footer line naming the sender. No sign-in, no menu, no cookies. A withdrawn or expired link says so in one plain sentence; a link that never existed says nothing about why. On a phone the A4 sheet is scaled to fit the screen.

**Rules worth knowing**
- **SMTP does not work on Render's free hosting**, which blocks mail ports; the screen says so beside the fields. Gmail and Microsoft 365 need an app password, not the normal one.
- **Record only is not emailed.** While Settings -> Sending is on "Record only" (the default), the dialog warns "Test mode: nothing will be emailed", the confirmation says "recorded, but NOT emailed", and the list, header and history say **Recorded only**.
- **Emailed is not received.** Without bounce notices the system only knows the email service accepted it, so the words are Emailed / Not delivered (the service refused it) / Given on WhatsApp, never Delivered.
- The share page is built from a **frozen copy** taken at send time, so the page and the attachment cannot disagree and a later edit never changes what the customer was sent.
- **Settings -> Sending** (sixth tab): on / off, the provider (`console` records only, `resend` really sends through Resend, `smtp` sends through the company's own mail server: server, port, username and a write-only password), the Resend key (write-only: shown as "Stored" with Replace), from name and address, reply-to, a readiness checklist and **Send a test email**. Only an admin can save it. Until it is set up, WhatsApp still works and email says so.
- This is not an FTA e-invoice; the PDF and email do not satisfy the e-invoicing mandate.
- Code: `lib/sendForms.js` (pure recipients / wording / phone rules), `lib/sendDocumentsApi.js` (multipart send; sets `Content-Type: multipart/form-data` or the PDF is dropped), `lib/shareApi.js` (bare `fetch`, never axios), `lib/sendState.js` (status words and pills), `PurchaseOrder/shared/documentPdf.jsx` (`sheetsPdfFile`). The server side is described in `foodERP/CLAUDE.md`, "Sending a document to the customer".
- Tests: `lib/__tests__/{sendForms,sendDocumentsApi}.test.js`, `components/send/__tests__/{shared,SendDialog,SendHistory,SharedDocument}.test.jsx`, `components/Settings/__tests__/SendingSettings.test.jsx`. `check:mobile` opens the dialog, the history and the public page at three widths.

### 7e. The organisation in the shell, and the developer console (`components/shell/Organisation*.jsx`, `src/platform/`)
The product is multi-tenant: a person belongs to one organisation, which has a plan, optional features, limits and a subscription. The server enforces all of it; the app only decides what to SHOW. See `foodERP/CLAUDE.md`, "Organisations, branches and the tenant scope".

**Inside the app**
- `Layout` wraps the shell in `OrganisationProvider`, which loads `GET /organisation/status` once (and again when a tab comes back after a minute). `useOrganisation()` gives `status`, `blocked`, `featureOn(key)` and `refresh`. **If the status cannot be loaded nothing is hidden and nothing is blocked**: the server still refuses, and a missing status must never lock a working organisation out.
- **Navigation** tabs may name a `feature` (`navigation.js`, the server's `utils/plans.js` keys). `getVisibleModules(status, modules)` hides a tab whose feature the plan lacks, and one the person's role does not hold the permission for (see 7f). A page reached by a typed address or bookmark shows `NotInPlan` instead of loading. Cash & bank is chart-based, not the `banking` feature, so it stays.
- **The top bar** names the organisation (`status.organisation.legalName`; the client pack's short name is the fallback) and the branch the person is working in, always (`BranchSwitcher`): a plain label for a branch user or a single-branch organisation, a dropdown for a head-office user in an organisation with more than one branch ("All branches" and each). Choosing one stores it for the tab (`axios/session.js`), sends it as `X-Branch` on every request and re-keys the page so every list is read again for that branch; a remembered branch that has gone is dropped. **"All branches" is offered only when `status.branch.canViewAll` is not false**: a person given a different role in any branch works in one branch at a time (the server puts them at head office if they ask for all), so the switcher lists the branches they may use (`status.branches`: everything for head office, their own plus the ones they were given for anyone else) and names the one in use; an older server that sends no `canViewAll` behaves as before. Changing branch re-reads `/organisation/status`, so the role and grants of the new branch apply at once. If the branch a tab remembered is refused (a role there was taken away, or the branch was switched off), the axios response interceptor forgets it and fires `BRANCH_RESET_EVENT` (`lib/organisation.js`) so the shell starts again from the person's own branch; the refused request is never re-sent without the header, because a document would silently land in the home branch. What is per branch and what is organisation-wide is in `foodERP/CLAUDE.md`.
- **`SubscriptionNotice`** (under the top bar): says so in the last 14 days, in the grace period, and for a read-only organisation. Words and rules are in `lib/organisation.js` (`subscriptionNotice`), all pure.
- **`OrganisationBlocked`** replaces the whole app when the subscription has ended (block rule), or the organisation is suspended or closed: why, since when, who to contact (`SUPPORT_CONTACT` on the server), **Check again** (after a renewal) and **Sign out**. Two things raise it: the status says `blocked`, or any request is refused with `ORGANISATION_EXPIRED | SUSPENDED | CLOSED` (the axios response interceptor fires the `organisation-blocked` window event; `lib/organisation.js` `BLOCKED_EVENT`). The sign-in page shows the same refusal as its error text.
- **`PasswordChangeRequired`** replaces the whole app (just after the blocked check) while `status.me.mustChangePassword` is true - a password that somebody else set. Current / new / confirm, a strength bar, **Show passwords**, **Sign out**; it sends `PUT /profile/change-password` and then reads the status again, so the app opens on the page the person asked for. The server refuses everything else until then (403 `PASSWORD_CHANGE_REQUIRED`). The rules (8 characters, not the same password, the two must match) are `lib/passwordForms.js`, shared with Settings -> Security.
- **Currency and time zone.** `status.organisation` carries `baseCurrency` and `timezone`; `OrganisationContext` hands them to `utils/orgLocale.js` (`setOrgLocale`), which `utils/format.js` formats money and dates with, and re-keys the page when they change (`localeKey`) so nothing keeps showing the old figure. Labels use `orgCurrency()`, never a literal "AED". With no status loaded it is AED and Dubai time, as before.
- Other refusals (`FEATURE_NOT_IN_PLAN`, `LIMIT_REACHED`, `ORGANISATION_READ_ONLY`) already carry a plain sentence; forms show `error.response.data.message` as they always have. `planRefusalMessage(error)` picks those out where a screen wants to.

**The developer console** (`/platform`, `src/platform/`) is a separate app for the people who run the product, mounted outside `RequireSession` and `Layout`:
- Its own sign-in and token (`platformSession.js`, sessionStorage key `zarvia.console`), its own axios client (`platformApi.js`; **never** the product's instance, so neither side's token is sent to the other). The session lasts 8 hours with no renewal; a 401 returns to the sign-in.
- **Organisations** (search, status filter; each row shows plan, books, state and when it ends), **New organisation** (legal name, optional code, country offering its usual currency and timezone, base currency, timezone, plan, first administrator with a suggested password; after creating it lists what was set up and shows the password once), **Activity** (every console change).
- **One organisation** (`OrganisationDetail.jsx`, tabs in `detailTabs.jsx`, kept in `?tab=`): Overview (subscription, use against limits, set-up with "Run set-up again"), Plan and features (plan; each feature follows the plan or is forced on / off; each limit follows the plan, is a number, or is unlimited), Subscription (renew by days, end date, grace days, blocked or read-only at the end), Company (letterhead and TRN corrections), People (add, change, give any of the organisation's roles - the ready-made ones and its own, marked custom - reset a password, switch off), Branches, Activity. **Suspend** / **Reopen** is a confirmed action in the header. Every save sends only what changed (`platformForms.js`, pure) and shows the server's own sentence on a refusal.
- The first developer is made with `npm run seed:platform` on the backend.
- Tests: `lib/__tests__/organisation.test.js`, `config/__tests__/navigation.test.js` (feature tags), `components/shell/__tests__/OrganisationShell.test.jsx`, `platform/__tests__/{platformForms.test.js,PlatformApp.test.jsx}`. `check:mobile` opens the console's four screens (the sign-in is not reachable in a run that seeds a console session) and the organisation's tabs at three widths.

### 7f. Users, roles and permissions (`components/users/`, `lib/permissions.js`, `lib/accessForms.js`, route `/users`)
What each person inside an organisation may do. **The server is the lock; the screens only decide what to show.** The rules, the catalogue and the enforcement are in `foodERP/CLAUDE.md`, "Users, roles and permissions".

**What the session knows.** `GET /organisation/status` carries `me { id, name, role { key, name, rank }, grants[] }`; `OrganisationContext` exposes `me`, `can(key)` and `canAny(keys)`. `grants` is the role already expanded (a role that approves also holds view), so the screen never computes inheritance. **If `me` is missing nothing is hidden** (a failed status must not lock anyone out; the server still refuses).

**Hiding (all in terms of one permission string, `module.action`):**
- `<Can permission="sales.edit">…</Can>` hides a control; `permission` may be a list (any one is enough). `<Guarded permission="settings.manage" what="the business rules">` replaces a whole panel with a plain "you cannot change this" note. `NotAllowed` replaces a page reached by typed address.
- Navigation: every tab in `config/navigation.js` names a `permission` (string or list) **or** an `open: "reason"` (only Settings today); a tab that names neither is refused by `tabAllowed` and by a test, so a new page cannot be added open by accident. The six old cosmetic role names and `roles` are gone.
- A 403 `PERMISSION_DENIED` is turned into a plain sentence by the axios interceptor (`isPermissionError`, `planRefusalMessage`), naming the role.
- Buttons: **Add** (`X.create`) is the "New …" / "Add …" button of every order, return, quotation, delivery note, customer, vendor, item, category, unit and voucher page; **Edit** (`X.edit`) is the row pencil and the quotation / delivery note `edit` action (`lib/salesDocuments.js` `allowActions` narrows what the document's STATE allows to what the ROLE holds); **Approve / Delete** likewise. Add and Edit are separate: someone may add without being able to change what they or others added.
- **The less common actions follow the same rule** (each hidden, never disabled; information stays visible, only the action goes): **Send**, **Try again now** and **Withdraw link** need `sales.send` (the send history and the "Emailed 6 Oct" pill stay; the pure rules in `lib/documentFlow.js` take `opts.canSend`, so an invoice nobody here may send reads "Done", not "Needs action", and there is no "Invoice not sent" nudge); the VAT return's **Save as draft**, **Finalise**, **Mark filed** and **Delete** need `reports.vat` (reading it needs `reports.financial`); a bank, card type or card master's **New** and the row pencil need `banking.manage`; on the reconciliation screen **Set up**, **Import a statement**, **Accept all strong matches**, **Match**, **Find**, **Post an entry**, **Card settlement**, **Ignore**, **Unmatch**, **Finish** and **Reopen** need `banking.reconcile` (a person with only `banking.view` still sees the suggestions, the proof, the history and the statements, with a one-line note that they can look but not change; a card with nothing left to press draws no empty frame); a cheque's **Clear**, **Bounced**, **Cancel** and **Returned** need `finance.approve`. Cash & bank's own links follow what they lead to (`accounts.manage`, `finance.create`, `banking.view`). **Accounting setup:** `accounts.manage` is New / Edit on the chart (accounts and groups, Restore default accounts), tax codes, fiscal years (New), the posting map (account pickers, the ledger-posting switch, the Save bar - a reader sees the mapped account's name as text), opening balances (the go-live date and the whole entry panel of each step, with Reverse / Remove), currencies (Add currency, the Use switch, Add rate, the rate tolerance - a reader gets "On / Off", a Rates button that opens the history without the add-rate form, and "Allowed difference: 5%") and the KYC document types; **`accounts.close`** is Close year / Reopen, independent of `accounts.manage` (each holder gets only their own buttons). A read-only person still sees every figure and gets an empty state that says who to ask instead of a prompt to create. Number series has no write route, so nothing to hide; `PUT /accounting/settings` (`settings.manage`) is reached only from Business rules, which uses `Guarded`.
- **Deleting an approved document** needs `<module>.deletePosted` (sales / purchase / finance), not plain Delete, because it reverses stock and ledger postings. `lib/permissions.js` holds the rule in one place (`deleteKey(module, posted)`, `isPostedDocument`, `planBulkDelete`, and the two sentences `skippedPostedText` / `postedDeleteText`). Each order list row (table and card, all four modules) gates its Delete with `deleteKey(module, status === "APPROVED")`, so an approved row offers Delete only to a holder of deletePosted - **this is new: approved rows had no Delete in the lists before** - and the type-to-confirm dialog then says it REVERSES the postings. Bulk Delete is offered with plain Delete; a selection that mixes approved and other documents sends only what the person may delete and says how many were left alone and why. A voucher's "Delete (reverse)" in `VoucherView` (every Finance tab) needs `finance.deletePosted`; the "also delete the entries posted for this match" tick-box on unmatch (bank reconciliation) needs it too. Quotations, delivery notes and masters are unchanged.
- **Staff** (`components/Staff/staff.jsx`, route `/staff-records`): the tab needs `staff.view`; **Add Staff Member**, the empty-state "Add First Staff Member" and the row Edit / Delete need `staff.manage` (the actions column is not drawn without it, and a reader's empty state says no records have been added instead of inviting them to add one). Owner and Administrator hold both; anyone else needs a custom role with them - managing sign-in accounts (`users.manage`) no longer opens the employee files. Test: `Staff/__tests__/StaffPermissions.test.jsx`.

**The Users and roles screen** (People module, second tab after Staff; `UsersPage.jsx`, `RoleEditor.jsx`). Two tabs, `?tab=people|roles`.
- **People**: list with role (and, under it, "Viewer in Sharjah" for each branch where they hold another role), branch, last sign-in and whether they can sign in; **Add a person** (name, email, password of 8+ characters, role, branch) and **Change** (name, role, branch, switched on/off, new password). A person is offered **only the roles below their own rank**, and **Change** only on people below them (the owner may change anyone); you may change your own name and nothing else. **Different role in a branch** (in the dialog, hidden in a one-branch organisation unless the person already has some): rows of branch + role, "Add a branch", the server's rank rule applied to each role; `branchRoles` is sent only when the section changed (`[]` clears them), a half-filled row, a repeated branch or an unknown one blocks Save under that row, and for yourself the section is read-only (the server refuses it). Rules in `lib/branchRoleForms.js` (pure), tests `lib/__tests__/branchRoleForms.test.js` and the "a different role in a branch" block of `UsersPage.test.jsx`; the switcher cases are in `OrganisationShell.test.jsx` ("working in one branch at a time") and `axios/__tests__/branchRefusal.test.js`.
- **Roles**: the built-in roles (read-only, with **Copy**) and the organisation's own. **New role** / **Change**: name, rank (a choice of steps below your own), key (new roles only, made from the name), description, then one section per module with a checkbox per action (View, Add, Edit, Approve, Delete, plus the module's own, such as Send to customers or Adjust stock), **All** / **None** per module.
- **The boxes follow the server's catalogue** (`GET /access/roles` returns `catalogue` with each action's `short` name, sentence, `read` flag and what ticking it `implies`), so the screen keeps no copy of the rules. Ticking Approve ticks and **locks** View (and what else it needs); unticking it frees them again (`lib/accessForms.js`: `effectiveOf`, `isLocked`, `toggle`, `toggleModule`, `minimal`). A person may **only tick what they hold themselves** (a box they lack is disabled with the reason as its title). The "Pick lists" module is automatic: anyone who can do more than look is given the lists a form chooses from.
- A built-in role opens read-only with **Copy as a new role**, which starts from the role's minimal ticks. An own role that people still hold cannot be removed (the button says why).
- **Approving: who may approve this document** (`lib/approvals.js`, pure; `components/shell/Approval.jsx`). Holding Approve is the first test; three optional controls decide the next, all off until set, all enforced by the server (`utils/approvalRules.js`, 403 `SELF_APPROVAL_NOT_ALLOWED` / `APPROVAL_LIMIT_EXCEEDED` / `SECOND_APPROVER_REQUIRED`): a role's **approval limit** (Users and roles -> role editor; asked for only when the role holds an Approve, empty = no limit, sent as `approvalLimit` number or null, a refusal shown under the field via `details.field`; the roles list says "Approval: Up to 5,000.00 AED" / "No limit"), the organisation's **separate approver** (the person who prepared a document cannot approve it) and **second approver above an amount** (Settings -> Business rules -> Approvals, `PUT /accounting/settings { approvals }`). `useOrganisation()` exposes `policy` (`status.policy.approvals`, default off). `approvalState({ doc, me, policy })` mirrors the server's checks in its order (own work, over my limit, already gave the first) -> `{ awaitingSecond, given, canApprove, reason }`; while `me` or the policy is unknown `canApprove` is true (never hide on a missing answer). Screens: Confirm / Approve is **hidden, never disabled** on a row or card the person could not approve (`useApproval().stateOf(doc)`); a document with its first approval and waiting for a second is badged "Awaiting second approval" (table row, card, voucher list/screen); the document screen's `ApprovalBanner` says why in one line ("You prepared this document, so someone else has to approve it." / "This is over your approval limit of X." / "You gave the first approval; a different person has to give the second."). An approve that answers `approval.awaitingSecond` is an **information** message ("First approval recorded. A second person must approve it before it takes effect."), never "approved"; the list is read again. A bulk approve (`approveMany` in `lib/processTransaction.js`) judges each document, never sends what the server would certainly refuse, goes on past a refusal and says "2 approved, 1 waiting for a second approver, 1 refused: <reason>". `VoucherView` has Approve / Reject for a pending voucher (`finance.approve`, same rules). Tests: `lib/__tests__/{approvals,processTransaction,settingsForm,accessForms}.test.js`, `shell/__tests__/Approval.test.jsx`, `PurchaseOrder/shared/__tests__/{approvalCases.jsx,approvalBanner.test.jsx}` + `approvals.test.jsx` in each of the four order modules, `finance/__tests__/VoucherViewApproval.test.jsx`, `users/__tests__/RoleApprovalLimit.test.jsx`, `Settings/__tests__/{BusinessRules,ApprovalRulesPermissions}.test.jsx`, `OrderEntry/__tests__/orderFormApproval.test.jsx` (the main gates were broken in turn and the matching tests failed).
- **Tests:** `lib/__tests__/{permissions,accessForms}.test.js` (pure), `config/__tests__/navigation.test.js`, `components/shell/__tests__/OrganisationShell.test.jsx`, `components/users/__tests__/UsersPage.test.jsx` (offers, refusals, the checkbox rules, what is sent; the lock rule was broken in turn and the tests failed), and the permission cases next to each gated screen: `components/banking/__tests__/BankingPermissions.test.jsx`, `Reports/__tests__/vatReturnPermissions.test.jsx`, `send/__tests__/sendHistoryPermissions.test.jsx`, `PurchaseOrder/sales/__tests__/sendPermissions.test.jsx`, `salesDocs/__tests__/CustomerDocumentsSendPermissions.test.jsx`, `accounting/__tests__/{ChartOfAccounts,Setup,OpeningBalances,Currencies}Permissions.test.jsx`, `parties/__tests__/KycDocumentsPermissions.test.jsx` (their `asRole.jsx` helpers render with the real `OrganisationProvider` and wait for the grants before asserting an absence; each gate was broken in turn and its test failed). `check:mobile` stubs `/access/*`, signs in as an administrator who holds every permission (so every page is still measured) and opens the add-person, change-person, new-role and built-in-role dialogs.

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
- `/settings` (`components/Settings/Settings.jsx`) has seven tabs, kept in the URL (`?tab=`): **Company** (the organisation's letterhead and logo - `GET|PUT /company/profile`; read-only, with a note, without `settings.manage`), **Branches** (`BranchSettings.jsx`: add a branch, rename it, switch it on or off; limited by the plan - see `foodERP/CLAUDE.md`), **Business rules** (`BusinessRules.jsx`: credit control, return rules, tax identity - the tax identity fills itself from the Company tab), **Invoice bank details** (printed on invoices; includes IBAN checksum and SWIFT), **Sending** (email and WhatsApp setup for sending documents to customers; see 7d), **Preferences** (theme, date format, time format - applied at once and remembered in this browser), **Security** (change password: 8 characters or more). Every control saves something; what is not built (language, notifications) is listed as "Coming soon". Tax codes, document numbering, fiscal years and posting accounts live in Accounting setup. Rules are in `lib/settingsForm.js`.
- **Date fields**: use `DateInput` (kit.jsx), never `<input type="date">`: it shows and accepts the date in the user's chosen format (typed, or from the calendar button) and still reports ISO `YYYY-MM-DD`. `min`/`max` guide the calendar only; the form explains a date outside the range.
- **Dates**: format every date through `utils/format.js` - `formatDate`, `formatTime`, `formatDateTime` (`formatDateGB` is the same function). They follow the Date / Time format preference and show the organisation's own time zone (`utils/orgLocale.js`; Dubai when none is known). Never call `toLocaleDateString` directly. Native `<input type="date">` is drawn by the browser and cannot follow the preference.

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
- **`PageErrorBoundary`** - a page that throws shows "Something went wrong on this page" (Reload page, Go to dashboard, folded technical details) instead of a blank window, with the rail and header still usable; moving to another page clears it. A page file that no longer exists after a new deploy reads "A newer version is available". `App.jsx` wraps the whole app in one too, as a last resort.

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
| `npm run check:mobile` | renders every route in `navigation.js` at 390 / 820 / 1440 against a stub API, screenshots it, and fails on horizontal overflow, a blank page, a crash, or a **cut-off control** (see below) |
| `npm run check:pwa` | builds, serves, and checks the manifest, icons, worker registration and that no API response was cached |

`check:mobile` writes to `.shots/` (gitignored) and drives its page list from `navigation.js`,
so a new screen is checked without anyone remembering to add it. Its stub API answers from
`scripts/shoot-mobile.mjs`; a page that comes back blank there usually means the stub's shape
has drifted from the server's, not that the page is broken. Since the error boundary, such a page no longer goes blank: it shows the error screen and logs `Page crashed:`, which the sweep reports as `THREW` and fails on - so a crash cannot read as a pass. Write a stub's shape from the screen's own test fixture.

**Cut-off controls (`findCutOff` in the sweep).** A card is `overflow-hidden`, so a row of buttons wider than it is not scrolled to - it is gone - and the page itself still fits, so the overflow check never saw it: on a phone the order cards' Send, Audit trail, Edit, Confirm and Delete sat up to 337px outside the card and could not be tapped. `findCutOff` runs on every page, tab panel and dialog and fails the sweep on any button, link, field or heading that sits partly or wholly outside the nearest ancestor that clips sideways (an ancestor that scrolls is fine: what is outside can be reached). The rule for a card, and for any row of actions inside a clipping box, is `flex flex-wrap gap-2`; the document number is `whitespace-nowrap`; a line's quantity and price are `shrink-0 whitespace-nowrap` so the NAME is what gives way. `PurchaseOrder/shared/__tests__/gridCardCases.jsx` pins those causes for all four order modules (jsdom has no layout). Steps marked `cards: true` in the sweep (the order modules' audit trails) run only below md, where the list is cards; from md up it is a table and the same buttons are in a row menu.

**Files plain Node loads.** `config/navigation.js` is read by the sweep under plain Node, so it, `lib/organisation.js` and `lib/permissions.js` must stay loadable there: relative imports with the `.js` extension, nothing only the bundler resolves. `utils/format.js` is not Node-loadable (extensionless imports, the brand config), which is why the subscription wording that needs the date formatter lives in `lib/subscriptionText.js`, not in `lib/organisation.js`. `config/__tests__/nodeLoadable.test.js` loads the three files in a real Node process, because every other test here goes through Vite and would stay green while the sweep broke.

**Tab strips.** `ui/tabs.jsx` `TabsList` is `justify-start`, not centred: a centred row that overflows spills to both sides and its first tabs cannot be scrolled to (on a phone, Settings -> Company and Branches were unreachable).

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
