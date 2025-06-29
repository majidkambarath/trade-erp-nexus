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
import NotFound from '../components/NotFound.jsx'
export default function AdminRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/vendor-creation" element={<VendorCreation />} />{" "}
        <Route path="/customer-creation" element={<CustomerCreation />} />{" "}
        <Route path="/stock-item-creation" element={<StockCreation />} />{" "}
        <Route path="/unit-setup" element={<UnitOfMeasure />} />{" "}
        <Route path="/staff-records" element={<Staff />} />{" "}
        <Route path="/settings" element={<Settings />} />{" "}
      </Route>
       {/* </Route> */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
