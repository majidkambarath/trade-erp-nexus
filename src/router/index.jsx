import React, { Suspense, lazy } from "react";
import { Route, Routes, Navigate } from "react-router-dom";

// Pages load on demand. The whole app used to arrive as one 2.6 MB script before anything
// could be drawn, which on a phone is seconds of nothing; now a page's code is fetched when
// it is first opened and cached by the service worker from then on. Layout and the sign-in
// page stay eager - they are the first paint - and the shell keeps its Suspense boundary
// around the Outlet, so navigating swaps the content and never the chrome.

import Layout from "../components/Layout.jsx";
import RequireSession from "../components/shell/RequireSession.jsx";
import NotFound from "../components/NotFound.jsx";
import ERPLogin from "../components/Login/Login.jsx";
const Dashboard = lazy(() => import("../pages/dashboardPage.jsx"));
const VendorCreation = lazy(() => import("../components/VendorModule/VendorManagement.jsx"));
const CustomerCreation = lazy(() => import("../components/Customer/CustomerManagement.jsx"));
const StockCreation = lazy(() => import("../components/Stock/StockManagement.jsx"));
const UnitOfMeasure = lazy(() => import("../components/UnitOfMeasure/UnitOfMeasure.jsx"));
const Staff = lazy(() => import("../components/Staff/staff.jsx"));
const Settings = lazy(() => import("../components/Settings/Settings.jsx"));
const PurchaseOrderPage = lazy(() => import("../components/PurchaseOrder/purchase/PurchaseOrderPage.jsx"));
const SalesOrderPage = lazy(() => import("../components/PurchaseOrder/sales/SalesOrderPage.jsx"));
const InventoryManagement = lazy(() => import("../components/Inventory/InventoryManagement.jsx"));
const PurchaseReturnPage = lazy(() => import("../components/PurchaseOrder/purchaseReturn/PurchaseOrderPage.jsx"));
const SalesReturnPage = lazy(() => import("../components/PurchaseOrder/salesReturn/SalesOrderPage.jsx"));
const CategoryManagement = lazy(() => import("../components/Inventory/CategoryManagement.jsx"));
const PurchaseAccounts = lazy(() => import("../components/AccountsModule/Purchase/PurchaseAccount.jsx"));
const SaleAccountsManagement = lazy(() => import("../components/AccountsModule//Sales/SaleAccountsManagement.jsx"));
const StockDetail = lazy(() => import("../components/Stock/StockDetail.jsx"));
const EInvoicing = lazy(() => import("../components/EInvoicing/EInvoicing.jsx"));
const ChartOfAccounts = lazy(() => import("../components/accounting/ChartOfAccounts.jsx"));
const LedgerBook = lazy(() => import("../components/accounting/LedgerBook.jsx"));
const JournalVouchers = lazy(() => import("../components/finance/JournalVouchers.jsx"));
const ContraVouchers = lazy(() => import("../components/finance/ContraVouchers.jsx"));
const ExpenseVouchers = lazy(() => import("../components/finance/ExpenseVouchers.jsx"));
const DebitCreditNotes = lazy(() => import("../components/finance/DebitCreditNotes.jsx"));
const BankMaster = lazy(() => import("../components/banking/BankMaster.jsx"));
const CardTypeMaster = lazy(() => import("../components/banking/CardTypeMaster.jsx"));
const CardMaster = lazy(() => import("../components/banking/CardMaster.jsx"));
const ChequeRegister = lazy(() => import("../components/banking/ChequeRegister.jsx"));
const CashAndBank = lazy(() => import("../components/banking/CashAndBank.jsx"));
const BankReconciliation = lazy(() => import("../components/banking/BankReconciliation.jsx"));
const AccountingSetup = lazy(() => import("../components/accounting/AccountingSetup.jsx"));
const LedgerReports = lazy(() => import("../components/Reports/LedgerReports.jsx"));
const PartyBalances = lazy(() => import("../components/Reports/PartyBalances.jsx"));
const VatReturn = lazy(() => import("../components/Reports/VatReturn.jsx"));
const StockReports = lazy(() => import("../components/Reports/StockReports.jsx"));
const IfrsStatements = lazy(() => import("../components/Reports/IfrsStatements.jsx"));
const OpeningBalances = lazy(() => import("../components/accounting/OpeningBalances.jsx"));
const KycDocuments = lazy(() => import("../components/parties/KycDocuments.jsx"));
const Currencies = lazy(() => import("../components/accounting/Currencies.jsx"));
const CurrencyRegister = lazy(() => import("../components/accounting/CurrencyRegister.jsx"));
const FinancialStatements = lazy(() => import("../components/Reports/FinancialStatements.jsx"));
const AgeingReport = lazy(() => import("../components/Reports/AgeingReport.jsx"));
const StatementOfAccount = lazy(() => import("../components/Reports/StatementOfAccount.jsx"));
const BatchManagement = lazy(() => import("../components/Inventory/BatchManagement.jsx"));
const VendorDetailsPage = lazy(() => import("../components/AccountsModule/Purchase/VendorDetailsPage.jsx"));
const CustomerDetailsPage = lazy(() => import("../components/AccountsModule/Sales/CustomerDetailsPage.jsx"));
const ReceiptVouchers = lazy(() => import("../components/finance/PartyVouchers.jsx").then((m) => ({ default: m.ReceiptVouchers })));
const PaymentVouchers = lazy(() => import("../components/finance/PartyVouchers.jsx").then((m) => ({ default: m.PaymentVouchers })));
const QuotationsPage = lazy(() => import("../components/salesDocs/QuotationsPage.jsx"));
const DeliveryNotesPage = lazy(() => import("../components/salesDocs/DeliveryNotesPage.jsx"));
// The page a customer opens from an emailed link. Lazy, so no signed-in user pays for it, and outside both
// the sign-in guard and the app shell, so it needs its own loading boundary (Layout owns the only other).
const SharedDocument = lazy(() => import("../components/send/SharedDocument.jsx"));
// The developer console: its own sign-in and frame, outside the product's session guard and shell, loaded only by the
// people who open it.
const PlatformApp = lazy(() => import("../platform/PlatformApp.jsx"));
const ConsoleLoading = () => <div role="status" className="grid min-h-screen place-items-center text-sm text-muted-foreground">Opening the console…</div>;
const SharedLoading = () => <div role="status" className="grid min-h-screen place-items-center text-sm text-muted-foreground">Opening the document…</div>;
export default function AdminRouter() {
  return (
    <Routes>
      <Route path="/" element={<ERPLogin />} />
      <Route path="/d/:token" element={<Suspense fallback={<SharedLoading />}><SharedDocument /></Suspense>} />
      <Route path="/platform/*" element={<Suspense fallback={<ConsoleLoading />}><PlatformApp /></Suspense>} />
      <Route element={<RequireSession />}>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vendor-creation" element={<VendorCreation />} />
        <Route path="/customer-creation" element={<CustomerCreation />} />
        <Route path="/stock-item-creation" element={<StockCreation />} />
        <Route path="/stock-detail/:id" element={<StockDetail />} />
        <Route path="/unit-setup" element={<UnitOfMeasure />} />
        <Route path="/staff-records" element={<Staff />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/purchase-order" element={<PurchaseOrderPage />} />
        <Route path="/sales-order" element={<SalesOrderPage />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/delivery-notes" element={<DeliveryNotesPage />} />
        <Route path="/inventory" element={<InventoryManagement />} />
        <Route path="/purchase-return" element={<PurchaseReturnPage />} />
        <Route path="/sales-return" element={<SalesReturnPage />} />
        <Route path="/category-management" element={<CategoryManagement />} />
        <Route path="/receipt-voucher" element={<ReceiptVouchers />} />
        <Route path="/payment-voucher" element={<PaymentVouchers />} />
        <Route path="/journal-voucher" element={<JournalVouchers />} />
        <Route path="/contra-voucher" element={<ContraVouchers />} />
        <Route path="/expense-voucher" element={<ExpenseVouchers />} />
        <Route path="/debit-credit-notes" element={<DebitCreditNotes />} />
        <Route path="/cheques" element={<ChequeRegister />} />
        <Route path="/cash-and-bank" element={<CashAndBank />} />
        <Route path="/bank-reconciliation" element={<BankReconciliation />} />
        <Route path="/ledger" element={<LedgerBook />} />
        <Route path="/banks" element={<BankMaster />} />
        <Route path="/card-types" element={<CardTypeMaster />} />
        <Route path="/cards" element={<CardMaster />} />
        <Route path="/debit-accounts" element={<PurchaseAccounts />} />
        <Route
          path="/debit-accounts/vendor/:vendorId"
          element={<VendorDetailsPage />}
        />
        <Route path="/credit-accounts" element={<SaleAccountsManagement />} />
        <Route
          path="/credit-accounts/customer/:customerId"
          element={<CustomerDetailsPage />}
        />
        {/* the old transaction list and cash/bank "transactors" were replaced by the Ledger and Cash & bank pages on the chart of accounts */}
        <Route path="/transactions" element={<Navigate to="/ledger" replace />} />
        <Route path="/transactors" element={<Navigate to="/cash-and-bank" replace />} />
        <Route path="/vat-reports" element={<VatReturn />} />
        <Route path="/e-invoicing" element={<EInvoicing />} />
        <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
        <Route path="/accounting-setup" element={<AccountingSetup />} />
        <Route path="/financial-statements" element={<FinancialStatements />} />
        <Route path="/ledger-reports" element={<LedgerReports />} />
        <Route path="/party-balances" element={<PartyBalances />} />
        <Route path="/stock-reports" element={<StockReports />} />
        <Route path="/ifrs-statements" element={<IfrsStatements />} />
        <Route path="/opening-balances" element={<OpeningBalances />} />
        <Route path="/kyc-documents" element={<KycDocuments />} />
        <Route path="/currencies" element={<Currencies />} />
        <Route path="/currency-register" element={<CurrencyRegister />} />
        <Route path="/ageing" element={<AgeingReport />} />
        <Route path="/statement" element={<StatementOfAccount />} />
        <Route path="/batches" element={<BatchManagement />} />
      </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
