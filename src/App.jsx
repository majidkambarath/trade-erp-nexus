import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminRouter from "./router/index";
import { ThemeProvider } from "./components/theme-provider";

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <BrowserRouter>
        <Routes>
          <Route path={"/*"} element={<AdminRouter />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
