import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { renderAs, statusFor } from "../../accounting/__tests__/asRole";

let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));

import BulkBar from "../BulkBar";

const approve = { key: "approve", label: "Approve", run: vi.fn(() => Promise.resolve({ changed: ["1", "2"] })) };
const del = {
  key: "delete",
  label: "Delete",
  danger: true,
  permission: "sales.deletePosted",
  confirm: (n) => ({ title: `Delete ${n} invoices?`, text: "This cannot be undone.", typeToConfirm: "delete" }),
  run: vi.fn(() => Promise.resolve({ changed: ["1"] })),
};

describe("BulkBar", () => {
  it("shows the count and an action with no confirm step runs at once", async () => {
    status = statusFor("sales.approve");
    const onDone = vi.fn();
    await renderAs(<BulkBar selection={["1", "2"]} onClear={vi.fn()} actions={[approve]} onDone={onDone} />);
    expect(screen.getByText("2 selected")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approve.run).toHaveBeenCalledWith(["1", "2"]));
    expect(onDone).toHaveBeenCalledWith(["1", "2"]);
    expect(await screen.findByRole("status")).toHaveTextContent("2 done.");
  });

  it("hides an action from a role that lacks its permission - never merely disables it", async () => {
    status = statusFor("sales.view"); // no sales.deletePosted
    await renderAs(<BulkBar selection={["1"]} onClear={vi.fn()} actions={[del]} />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows an action to a role that holds its permission", async () => {
    status = statusFor("sales.deletePosted");
    await renderAs(<BulkBar selection={["1"]} onClear={vi.fn()} actions={[del]} />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  it("asks before an action with confirm, and does nothing until the dialog is confirmed", async () => {
    status = statusFor("sales.deletePosted");
    await renderAs(<BulkBar selection={["1"]} onClear={vi.fn()} actions={[del]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete 1 invoices?")).toBeVisible();
    expect(del.run).not.toHaveBeenCalled();
    // the confirm button is disabled until "delete" is typed (typeToConfirm)
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(del.run).not.toHaveBeenCalled();
  });

  it("runs the action once typeToConfirm is satisfied, and reports a partial result", async () => {
    status = statusFor("sales.deletePosted");
    const onDone = vi.fn();
    await renderAs(<BulkBar selection={["1", "2"]} onClear={vi.fn()} actions={[{ ...del, run: vi.fn(() => Promise.resolve({ changed: ["1"], skipped: ["2"] })) }]} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: "delete" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1));
    expect(await screen.findByRole("status")).toHaveTextContent("1 done, 1 left alone.");
    expect(onDone).toHaveBeenCalledWith(["1"]);
  });

  it("reports a failure without pretending anything changed", async () => {
    status = statusFor("sales.approve");
    const failing = { key: "approve", label: "Approve", run: vi.fn(() => Promise.reject(new Error("Network down"))) };
    await renderAs(<BulkBar selection={["1"]} onClear={vi.fn()} actions={[failing]} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Network down");
  });

  it("Clear calls onClear", async () => {
    status = statusFor("sales.view");
    const onClear = vi.fn();
    await renderAs(<BulkBar selection={["1"]} onClear={onClear} actions={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders nothing at all when there is no visible action and no onClear", async () => {
    status = statusFor("sales.view");
    await renderAs(<BulkBar selection={["1"]} actions={[del]} />);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });
});
