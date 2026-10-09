import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AsRole, roleLoaded, statusFor } from "./asRole";
import { ApprovalBanner, AwaitingSecondBadge, useApproval } from "../Approval";
import { useOrganisation } from "../OrganisationContext";

// The words on a document's own screen about approving, and the policy the shell hands every screen. The rules are
// lib/approvals.js (pure, lib/__tests__/approvals.test.js); this proves the screen reads them through the real
// OrganisationProvider, and - the part that matters - says nothing before it knows who is asking.
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

const person = ({ grants = ["sales.view", "sales.approve"], limit = null, policy } = {}) => {
  const base = statusFor(grants);
  return { ...base, me: { ...base.me, id: "u1", role: { ...base.me.role, approvalLimit: limit } }, ...(policy ? { policy: { approvals: policy } } : {}) };
};
const doc = (over = {}) => ({ status: "DRAFT", totalAmount: 900, createdBy: "u2", approvals: [], ...over });
const FIRST = [{ by: "u9", name: "Sam Khan", at: "2026-10-08T09:00:00Z", step: 1 }];

beforeEach(() => {
  orgStatus = null;
});

describe("the policy the shell exposes", () => {
  function Show() {
    const { policy } = useOrganisation();
    return <p data-testid="policy">{JSON.stringify(policy)}</p>;
  }

  it("is the organisation's, read from the status", async () => {
    orgStatus = person({ policy: { separateApprover: true, secondApprovalAbove: 5000 } });
    render(<AsRole><Show /></AsRole>);
    await roleLoaded();
    expect(JSON.parse(screen.getByTestId("policy").textContent)).toEqual({ separateApprover: true, secondApprovalAbove: 5000 });
  });

  it("is off when the organisation has set nothing, or the status does not carry it", async () => {
    orgStatus = person();
    render(<AsRole><Show /></AsRole>);
    await roleLoaded();
    expect(JSON.parse(screen.getByTestId("policy").textContent)).toEqual({ separateApprover: false, secondApprovalAbove: null });
  });

  it("is off outside the provider", () => {
    render(<Show />);
    expect(JSON.parse(screen.getByTestId("policy").textContent)).toEqual({ separateApprover: false, secondApprovalAbove: null });
  });
});

describe("the line on a document's own screen", () => {
  const show = async (status, d, permission = "sales.approve") => {
    orgStatus = status;
    render(<AsRole><ApprovalBanner doc={d} permission={permission} /></AsRole>);
    await roleLoaded();
  };

  it("says the person prepared it, when the organisation asks for a separate approver", async () => {
    await show(person({ policy: { separateApprover: true, secondApprovalAbove: null } }), doc({ createdBy: "u1" }));
    expect(await screen.findByText("You prepared this document, so someone else has to approve it.")).toBeInTheDocument();
  });

  it("says it is over the person's own limit, naming the limit", async () => {
    await show(person({ limit: 500 }), doc({ totalAmount: 900 }));
    expect(await screen.findByText("This is over your approval limit of 500.00 AED.")).toBeInTheDocument();
  });

  it("says it waits for a second approval, and that this person gave the first", async () => {
    await show(person({ policy: { separateApprover: false, secondApprovalAbove: 500 } }), doc({ approvals: [{ by: "u1", name: "Me", step: 1 }] }));
    expect(await screen.findByText("Awaiting second approval.")).toBeInTheDocument();
    expect(screen.getByText("You gave the first approval; a different person has to give the second.")).toBeInTheDocument();
  });

  it("says it waits for a second approval to someone who has simply not been asked yet, without a reason that is not theirs", async () => {
    await show(person({ policy: { separateApprover: false, secondApprovalAbove: 500 } }), doc({ approvals: FIRST }));
    expect(await screen.findByText("Awaiting second approval.")).toBeInTheDocument();
    expect(screen.getByText(/One person has approved it; a different person has to give the second approval/)).toBeInTheDocument();
  });

  it("tells a person who could never approve it that it waits, but not why they cannot approve", async () => {
    await show(person({ grants: ["sales.view"], limit: 100, policy: { separateApprover: false, secondApprovalAbove: 500 } }), doc({ approvals: FIRST }));
    expect(await screen.findByText("Awaiting second approval.")).toBeInTheDocument();
    expect(screen.queryByText(/over your approval limit/)).toBeNull();
  });

  it("says nothing when the person may approve it and nothing waits", async () => {
    await show(person(), doc());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says nothing about a document that is already decided", async () => {
    await show(person({ policy: { separateApprover: true, secondApprovalAbove: 500 } }), doc({ status: "APPROVED", createdBy: "u1", approvals: FIRST }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says nothing before it knows who is asking", () => {
    orgStatus = new Promise(() => {}); // the status never arrives
    render(<AsRole><ApprovalBanner doc={doc({ createdBy: "u1" })} permission="sales.approve" /></AsRole>);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the badge", () => {
  function Row({ d }) {
    const { stateOf } = useApproval();
    return <AwaitingSecondBadge doc={d} state={stateOf(d)} />;
  }

  it("names the first approver in its title", async () => {
    orgStatus = person({ policy: { separateApprover: false, secondApprovalAbove: 500 } });
    render(<AsRole><Row d={doc({ approvals: FIRST })} /></AsRole>);
    await roleLoaded();
    expect(screen.getByText("Awaiting second approval")).toHaveAttribute("title", "First approval by Sam Khan");
  });

  it("is not drawn for a document that waits for nothing", async () => {
    orgStatus = person({ policy: { separateApprover: false, secondApprovalAbove: 500 } });
    render(<AsRole><Row d={doc()} /></AsRole>);
    await roleLoaded();
    expect(screen.queryByText("Awaiting second approval")).toBeNull();
  });
});
