import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";

import Dashboard from "../pages/dashboardPage.jsx";
import Layout from "../components/Layout.jsx";
import VendorCreation from "../components/VendorModule/VendorManagement.jsx";
import CustomerCreation from "../components/Customer/CustomerManagement.jsx";
import StockCreation from "../components/Stock/StockManagement.jsx";
import UnitOfMeasure from "../components/UnitOfMeasure/UnitOfMeasure.jsx";
import Staff from "../components/Staff/staff.jsx";
import Settings from "../components/Settings/Settings.jsx";
import NotFound from "../components/NotFound.jsx";
import ERPLogin from "../components/Login/Login.jsx";
import PurchaseOrderPage from "../components/PurchaseOrder/purchase/PurchaseOrderPage.jsx";
import SalesOrderPage from "../components/PurchaseOrder/sales/SalesOrderPage.jsx";
import InventoryManagement from "../components/Inventory/InventoryManagement.jsx";
import PurchaseReturnPage from "../components/PurchaseOrder/purchaseReturn/PurchaseOrderPage.jsx";
import SalesReturnPage from "../components/PurchaseOrder/salesReturn/SalesOrderPage.jsx";
import CategoryManagement from "../components/Inventory/CategoryManagement.jsx";
import PurchaseAccounts from "../components/AccountsModule/Purchase/PurchaseAccount.jsx";
import SaleAccountsManagement from "../components/AccountsModule//Sales/SaleAccountsManagement.jsx";
import StockDetail from "../components/Stock/StockDetail.jsx";
import EInvoicing from "../components/EInvoicing/EInvoicing.jsx";
import ChartOfAccounts from "../components/accounting/ChartOfAccounts.jsx";
import LedgerBook from "../components/accounting/LedgerBook.jsx";
import { ReceiptVouchers, PaymentVouchers } from "../components/finance/PartyVouchers.jsx";
import JournalVouchers from "../components/finance/JournalVouchers.jsx";
import ContraVouchers from "../components/finance/ContraVouchers.jsx";
import ExpenseVouchers from "../components/finance/ExpenseVouchers.jsx";
import DebitCreditNotes from "../components/finance/DebitCreditNotes.jsx";
import BankMaster from "../components/banking/BankMaster.jsx";
import CardTypeMaster from "../components/banking/CardTypeMaster.jsx";
import CardMaster from "../components/banking/CardMaster.jsx";
import ChequeRegister from "../components/banking/ChequeRegister.jsx";
import CashAndBank from "../components/banking/CashAndBank.jsx";
import AccountingSetup from "../components/accounting/AccountingSetup.jsx";
import LedgerReports from "../components/Reports/LedgerReports.jsx";
import PartyBalances from "../components/Reports/PartyBalances.jsx";
import VatReturn from "../components/Reports/VatReturn.jsx";
import StockReports from "../components/Reports/StockReports.jsx";
import IfrsStatements from "../components/Reports/IfrsStatements.jsx";
import OpeningBalances from "../components/accounting/OpeningBalances.jsx";
import KycDocuments from "../components/parties/KycDocuments.jsx";
import Currencies from "../components/accounting/Currencies.jsx";
import CurrencyRegister from "../components/accounting/CurrencyRegister.jsx";
import FinancialStatements from "../components/Reports/FinancialStatements.jsx";
import AgeingReport from "../components/Reports/AgeingReport.jsx";
import StatementOfAccount from "../components/Reports/StatementOfAccount.jsx";
import BatchManagement from "../components/Inventory/BatchManagement.jsx";
import VendorDetailsPage from "../components/AccountsModule/Purchase/VendorDetailsPage.jsx";
import CustomerDetailsPage from "../components/AccountsModule/Sales/CustomerDetailsPage.jsx";
export default function AdminRouter() {
  return (
    <Routes>
      <Route path="/" element={<ERPLogin />} />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
