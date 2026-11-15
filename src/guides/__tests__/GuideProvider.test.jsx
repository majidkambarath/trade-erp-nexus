import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("../../components/shell/OrganisationContext", () => ({
  useOrganisation: () => ({ status: { me: { id: "u1" } }, mayUse: () => true }),
}));
import { GuideProvider } from "../GuideProvider";
import { useGuides } from "../guideContext";

function Customers() {
  const { start } = useGuides();
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button onClick={() => start("add-customer")}>begin</button>
      <button onClick={() => setOpen(true)}>Add Customer</button>
      {open && (
        <div role="dialog">
          <label htmlFor="n">Customer name *</label><input id="n" />
        </div>
      )}
    </div>
  );
}
const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const mount = (path = "/customer-creation") => render(
  <MemoryRouter initialEntries={[path]}>
    <GuideProvider>
      <Where />
      <Routes>
        <Route path="/customer-creation" element={<Customers />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </GuideProvider>
  </MemoryRouter>
);

describe("GuideProvider", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("points at the button, waits for the click, then moves to the next field", async () => {
    mount();
    fireEvent.click(screen.getByText("begin"));
    // the page is already the right one, so the go step is skipped and the first card is the Add button
    await screen.findByText("Add the customer");
    expect(screen.getByText(/Step 1 of/)).toBeTruthy();
    fireEvent.click(screen.getByText("Add Customer")); // the person does it
    await waitFor(() => expect(screen.getByText("Their name")).toBeTruthy(), { timeout: 2000 });
  });

  it("takes the person to the page when they are somewhere else", async () => {
    mount("/somewhere");
    // start from a page that has no begin button: use the context directly
    function Starter() { const g = useGuides(); React.useEffect(() => { g.start("add-customer"); }, []); return null; } // eslint-disable-line
     
    const { unmount } = render(<MemoryRouter initialEntries={["/somewhere"]}><GuideProvider><Where /><Starter /><Routes><Route path="/customer-creation" element={<Customers />} /><Route path="*" element={<div>x</div>} /></Routes></GuideProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByTestId("where").some((n) => n.textContent === "/customer-creation")).toBe(true));
    unmount();
  });

  it("Stop ends the guide and removes the card", async () => {
    mount();
    fireEvent.click(screen.getByText("begin"));
    await screen.findByText("Add the customer");
    fireEvent.click(screen.getByLabelText("Stop guide"));
    expect(screen.queryByText("Add the customer")).toBeNull();
  });

  it("says so when it cannot find the control, instead of waiting for ever", async () => {
    vi.useFakeTimers();
    try {
      render(<MemoryRouter initialEntries={["/customer-creation"]}><GuideProvider><Starter2 /><div>no button here</div></GuideProvider></MemoryRouter>);
      await act(async () => { vi.advanceTimersByTime(9000); });
      expect(screen.getByText(/can't find this on your screen/i)).toBeTruthy();
    } finally { vi.useRealTimers(); }
  });

  it("switches language; Arabic sets right-to-left and English words stay for lines not yet translated", async () => {
    mount();
    fireEvent.click(screen.getByText("begin"));
    await screen.findByText("Add the customer");
    fireEvent.click(screen.getByTitle("العربية"));
    await waitFor(() => expect(document.querySelector("[data-guide-overlay]").getAttribute("dir")).toBe("rtl"));
    expect(screen.getByText("Add the customer")).toBeTruthy(); // not translated yet: falls back, never blank
    expect(await screen.findByText("Translation in review")).toBeTruthy();
  });
});

function Starter2() { const g = useGuides(); React.useEffect(() => { g.start("add-customer"); }, []); return null; } // eslint-disable-line
