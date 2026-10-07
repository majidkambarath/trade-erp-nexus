import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminRouter from "./router/index";
import { ThemeProvider } from "./components/theme-provider";
import PageErrorBoundary from "./components/shell/PageErrorBoundary";

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      {/* last resort: the shell or sign-in page itself failed (pages have their own, inside) */}
      <PageErrorBoundary scope="app">
        <BrowserRouter>
          <Routes>
            <Route path={"/*"} element={<AdminRouter />} />
          </Routes>
        </BrowserRouter>
      </PageErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
