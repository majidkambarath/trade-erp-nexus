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
import ReceiptVoucherManagement from "../components/FinancialModules/Receipt/ReceiptVoucher.jsx";
import PaymentVoucherManagement from "../components/FinancialModules/Payment/PaymentVoucher.jsx";
import PurchaseAccounts from "../components/AccountsModule/Purchase/PurchaseAccount.jsx";
import SaleAccountsManagement from "../components/AccountsModule//Sales/SaleAccountsManagement.jsx";
import TransactionsManagement from "../components/AccountsModule/Transaction/TransactionsManagement.jsx";
import TransactorsManagement from "../components/AccountsModule/Transactors/TransactorsManagement.jsx";
import JournalVoucherManagement from "../components/FinancialModules/Journal/JournalVoucherManagement.jsx";
import ContraVoucherManagement from "../components/FinancialModules/Contra/ContraVoucherManagement.jsx";
import ExpenseVoucherManagement from "../components/FinancialModules/Expense/ExpenseVoucherManagement.jsx";
import StockDetail from "../components/Stock/StockDetail.jsx";
export default function AdminRouter() {
  return (
    <Routes>
      <Route path="/" element={<ERPLogin />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vendor-creation" element={<VendorCreation />} />{" "}
        <Route path="/customer-creation" element={<CustomerCreation />} />{" "}
        <Route path="/stock-item-creation" element={<StockCreation />} />{" "}
        <Route path="/stock-item-creation" element={<StockCreation />} />{" "}
         <Route path="/stock-detail/:id" element={<StockDetail />} />{" "}
        <Route path="/unit-setup" element={<UnitOfMeasure />} />{" "}
        <Route path="/staff-records" element={<Staff />} />{" "}
        <Route path="/settings" element={<Settings />} />{" "}
        <Route path="/purchase-order" element={<PurchaseOrderPage />} />{" "}
        <Route path="/sales-order" element={<SalesOrderPage />} />{" "}
        <Route path="/inventory" element={<InventoryManagement />} />{" "}
        <Route path="/purchase-return" element={<PurchaseReturnPage />} />{" "}
        <Route path="/sales-return" element={<SalesReturnPage />} />{" "}
        <Route path="/category-management" element={<CategoryManagement />} />
        {/* financial */}
        <Route
          path="/receipt-voucher"
          element={<ReceiptVoucherManagement />}
        />{" "}
        <Route path="/payment-voucher" element={<PaymentVoucherManagement />} />{" "}
        <Route path="/journal-voucher" element={<JournalVoucherManagement />} />{" "}
        <Route path="/contra-voucher" element={<ContraVoucherManagement />} />{" "}
                <Route path="/expense-voucher" element={<ExpenseVoucherManagement />} />{" "}
        {/* Accounts Module */}
        <Route
          path="/purchase-accounts"
          element={<PurchaseAccounts />}
        />{" "}
        <Route
          path="/sales-accounts"
          element={<SaleAccountsManagement />}
        />{" "}
        <Route
          path="/transactions"
          element={<TransactionsManagement />}
        />{" "}
        <Route
          path="/transactors"
          element={<TransactorsManagement />}
        />{" "}
        <Route path="/payment-voucher" element={<PaymentVoucherManagement />} />{" "}
      </Route>
      {/* </Route> */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
