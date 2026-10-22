import React from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import AdminRouter from "./router/index";
import { ThemeProvider } from "./components/theme-provider";
import PageErrorBoundary from "./components/shell/PageErrorBoundary";

// A data router, for one reason: it is the only way to be told about a move BEFORE it happens, which
// is what lets a half-typed form ask "leave without saving?" and stay where it is when the answer is
// no - the Back button included, where a popstate listener is always told too late (see
// shell/UnsavedWorkProvider). The route tree itself is untouched: AdminRouter is still the same flat
// <Routes> list, mounted here as a descendant, so nothing about how a page is matched or loaded has
// changed. Built once at module level, because a router rebuilt on a render would lose its history.
const router = createBrowserRouter([{ path: "*", element: <AdminRouter /> }]);

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      {/* last resort: the shell or sign-in page itself failed (pages have their own, inside) */}
      <PageErrorBoundary scope="app">
        <RouterProvider router={router} />
      </PageErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
