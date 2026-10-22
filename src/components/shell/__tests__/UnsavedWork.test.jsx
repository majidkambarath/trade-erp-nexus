import React, { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog, Field, Modal, TextInput } from "../../accounting/kit";
import UnsavedWorkProvider from "../UnsavedWorkProvider";

// What a person who has typed something is asked, and when. There are three ways out of a half-filled
// form and all three are covered here: closing the dialog, moving to another page (a link, a button,
// the Back button) and reloading the tab.

const press = (name) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const dialogOf = (text) => screen.getByText(text).closest('[role="dialog"]');

function CustomerDialog({ onClose, ...rest }) {
  const [name, setName] = useState("");
  return (
    <Modal title="Add a customer" onClose={onClose} {...rest}>
      <Field label="Customer name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
    </Modal>
  );
}

describe("closing a dialog that has something in it", () => {
  it("asks before it throws away what was typed, and keeps the dialog exactly as it was", () => {
    const onClose = vi.fn();
    render(<CustomerDialog onClose={onClose} />);

    type("Customer name", "Al Noor Trading");
    press("Close");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Discard your changes?")).toBeInTheDocument();
    press(/keep editing/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Discard your changes?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Customer name")).toHaveValue("Al Noor Trading"); // nothing was lost
  });

  it("closes once the person says to discard it", () => {
    const onClose = vi.fn();
    render(<CustomerDialog onClose={onClose} />);
    type("Customer name", "Al Noor");
    press("Close");
    press(/discard and close/i);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks on Escape too, not only on the close button", () => {
    const onClose = vi.fn();
    render(<CustomerDialog onClose={onClose} />);
    type("Customer name", "A");
    fireEvent.keyDown(dialogOf("Add a customer"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Discard your changes?")).toBeInTheDocument();
  });

  it("closes without a word when nothing has been typed: a dialog that only shows something is as quiet as it ever was", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Audit trail" onClose={onClose}>
        <p>Nothing to type in here.</p>
      </Modal>
    );
    press("Close");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard your changes?")).not.toBeInTheDocument();
  });

  it("the safe answer is the one that has focus, so a stray Enter keeps the work", () => {
    render(<CustomerDialog onClose={vi.fn()} />);
    type("Customer name", "A");
    press("Close");
    expect(screen.getByRole("button", { name: /keep editing/i })).toHaveFocus();
  });

  it("a form that knows its own state is believed over the watching", () => {
    const onClose = vi.fn();
    // dirty={false} from a form that has compared itself with what is saved: typing something and
    // undoing it leaves nothing to lose, and this must not ask.
    render(<CustomerDialog onClose={onClose} dirty={false} />);
    type("Customer name", "A");
    press("Close");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("...and a form that says it is dirty is asked about before anything is typed", () => {
    const onClose = vi.fn();
    render(<CustomerDialog onClose={onClose} dirty />);
    press("Close");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Discard your changes?")).toBeInTheDocument();
  });

  it("a search box inside a dialog is not unsaved work", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Find a voucher" onClose={onClose}>
        <input type="search" aria-label="Search" />
      </Modal>
    );
    type("Search", "RV-2026");
    press("Close");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a confirmation's own typed word is not unsaved work either: Cancel simply cancels", () => {
    const onClose = vi.fn();
    render(<ConfirmDialog title="Delete the invoice?" text="It reverses the postings." typeToConfirm="delete" onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "delete" } });
    press(/^cancel$/i);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("leaving the page", () => {
  // The guard needs a data router: it is the only thing told about a move before it happens.
  const mount = (ui, entries = ["/customer-creation"]) => {
    const router = createMemoryRouter(
      [
        { path: "/customer-creation", element: <UnsavedWorkProvider>{ui}</UnsavedWorkProvider> },
        { path: "/dashboard", element: <p>The dashboard</p> },
      ],
      { initialEntries: entries }
    );
    render(<RouterProvider router={router} />);
    return router;
  };

  function GoToDashboard() {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate("/dashboard")}>Go to the dashboard</button>;
  }

  const withDialog = (
    <>
      <GoToDashboard />
      <CustomerDialog onClose={vi.fn()} />
    </>
  );

  it("asks before a move to another page, names the form, and stays put when the answer is no", () => {
    mount(withDialog);
    type("Customer name", "Al Noor");
    press(/go to the dashboard/i);

    expect(screen.getByText("Leave without saving?")).toBeInTheDocument();
    expect(within(dialogOf("Leave without saving?")).getByText(/the “Add a customer” form/)).toBeInTheDocument();
    press(/keep editing/i);
    expect(screen.queryByText("The dashboard")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Customer name")).toHaveValue("Al Noor");
  });

  it("goes once the person says to leave", async () => {
    mount(withDialog);
    type("Customer name", "Al Noor");
    press(/go to the dashboard/i);
    press(/leave and lose it/i);
    expect(await screen.findByText("The dashboard")).toBeInTheDocument();
  });

  it("says nothing while there is nothing unsaved", async () => {
    mount(withDialog);
    press(/go to the dashboard/i);
    expect(await screen.findByText("The dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Leave without saving?")).not.toBeInTheDocument();
  });

  it("the Back button is asked about as well", async () => {
    const router = mount(withDialog, ["/dashboard", "/customer-creation"]);
    type("Customer name", "Al Noor");

    act(() => {
      router.navigate(-1);
    });
    expect(await screen.findByText("Leave without saving?")).toBeInTheDocument();
    expect(screen.queryByText("The dashboard")).not.toBeInTheDocument();
  });
});

describe("reloading or closing the tab", () => {
  const unload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it("warns, in the browser's own words, while something is unsaved", () => {
    render(<CustomerDialog onClose={vi.fn()} />);
    expect(unload()).toBe(false); // nothing typed yet
    type("Customer name", "Al Noor");
    expect(unload()).toBe(true);
  });

  it("stops warning once the dialog is gone", () => {
    const { unmount } = render(<CustomerDialog onClose={vi.fn()} />);
    type("Customer name", "Al Noor");
    unmount();
    expect(unload()).toBe(false);
  });
});
