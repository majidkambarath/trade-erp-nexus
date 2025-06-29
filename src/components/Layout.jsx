import React from "react";
import SidebarPage from "./SideBar.jsx";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <div className="flex min-h-screen">
      <SidebarPage />
      <div className="flex-1  overflow-y-auto scrollbar-thin scrollbar-thumb-[#2D2D2D] scrollbar-track-[#121212]">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
