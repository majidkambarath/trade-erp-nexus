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
import ReceiptVoucherManagement from "../components/FinancialModules/receiptVoucher.jsx";
import PaymentVoucherManagement from "../components/FinancialModules/PaymentVoucher.jsx";
export default function AdminRouter() {
  return (
    <Routes>
      <Route path="/" element={<ERPLogin />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vendor-creation" element={<VendorCreation />} />{" "}
        <Route path="/customer-creation" element={<CustomerCreation />} />{" "}
        <Route path="/stock-item-creation" element={<StockCreation />} />{" "}
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
      </Route>
      {/* </Route> */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
