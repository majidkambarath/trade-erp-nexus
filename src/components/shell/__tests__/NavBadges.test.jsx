import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The number beside "Approvals": asked of the server only by a person who may approve something, in the cheap count-only form,
// refreshed when something is decided, and shown wherever the navigation names the tab (header tabs, rail, bottom bar, More).
// A failure shows nothing rather than a wrong number.

const m = vi.hoisted(() => ({ count: vi.fn(), myWork: vi.fn(), unreadCount: vi.fn(), crmCount: vi.fn() }));
vi.mock("../../../lib/processOrderApi", () => ({ PROCESS_WORK_CHANGED: "process-work-changed", processOrders: { myWork: m.myWork } }));
vi.mock("../../../lib/approvalsApi", async (importOriginal) => ({ ...(await importOriginal()), approvalQueue: { count: m.count, waiting: vi.fn() } }));
vi.mock("../../../lib/notificationsApi", async (importOriginal) => ({ ...(await importOriginal()), notifications: { unreadCount: m.unreadCount } }));
vi.mock("../../../lib/crmApi", async (importOriginal) => ({ ...(await importOriginal()), crm: { followUpCount: m.crmCount } }));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import { OrganisationProvider, useOrganisation } from "../OrganisationContext";
import { NavBadgesProvider, useNavBadge } from "../NavBadges";
import { announceNotificationsChanged } from "../../../lib/notificationsApi";
import ModuleTabs from "../ModuleTabs";
import AppRail from "../AppRail";
import BottomNav from "../BottomNav";
import MoreSheet from "../MoreSheet";
import { MODULES, getVisibleModules } from "../../../config/navigation";
import { announceApprovalsChanged } from "../../../lib/approvalsApi";
import { statusFor } from "./asRole";

const HOME = MODULES.find((x) => x.id === "home");

function Known() {
  const { me } = useOrganisation();
  return me ? <span data-testid="known" /> : null;
}

const renderAs = async (grants, ui) => {
  orgStatus = statusFor(grants);
  const view = render(
    <MemoryRouter>
      <OrganisationProvider>
        <Known />
        <NavBadgesProvider>{ui}</NavBadgesProvider>
      </OrganisationProvider>
    </MemoryRouter>
  );
  await screen.findByTestId("known");
  return view;
};
// the Home module as that person's navigation shows it (the Approvals tab only for someone who may approve)
const homeFor = (grants) => getVisibleModules(statusFor(grants)).find((x) => x.id === "home");

beforeEach(() => {
  vi.clearAllMocks();
  m.count.mockResolvedValue({ count: 4, others: 1, capped: false });
  m.myWork.mockResolvedValue({ count: 3 });
  m.unreadCount.mockResolvedValue({ count: 0 });
  m.crmCount.mockResolvedValue({ count: 0 });
});

describe("the approvals count", () => {
  it("is shown beside the Approvals tab for a person who may approve", async () => {
    const home = homeFor(["reports.view", "sales.approve"]);
    await renderAs(["reports.view", "sales.approve"], <ModuleTabs module={home} activeTab={home.tabs[0]} />);
    const link = await screen.findByRole("link", { name: /Approvals.*4 waiting/ });
    expect(link).toHaveAttribute("href", "/approvals");
    expect(m.count).toHaveBeenCalledTimes(1);
  });

  it("is not asked for, and not shown, for a person who may not approve anything", async () => {
    const home = homeFor(["reports.view", "sales.view", "finance.create"]);
    await renderAs(["reports.view", "sales.view", "finance.create"], <ModuleTabs module={home} activeTab={home.tabs[0]} />);
    // (the Dashboard is the module's only tab for them: no tab row, and so nowhere for a number)
    expect(screen.queryByRole("link", { name: /Approvals/ })).toBeNull();
    expect(m.count).not.toHaveBeenCalled();
  });

  it("shows nothing at zero, and nothing when the count cannot be read", async () => {
    m.count.mockResolvedValue({ count: 0, others: 3 });
    const home = homeFor(["reports.view", "finance.approve"]);
    const { unmount } = await renderAs(["reports.view", "finance.approve"], <ModuleTabs module={home} activeTab={home.tabs[0]} />);
    await waitFor(() => expect(m.count).toHaveBeenCalled());
    expect(await screen.findByRole("link", { name: "Approvals" })).toBeInTheDocument(); // (the control: the tab is there, with no number)
    unmount();

    m.count.mockRejectedValue(new Error("offline"));
    await renderAs(["reports.view", "finance.approve"], <ModuleTabs module={home} activeTab={home.tabs[0]} />);
    expect(await screen.findByRole("link", { name: "Approvals" })).toBeInTheDocument();
    await waitFor(() => expect(m.count).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/waiting/)).toBeNull();
  });

  it("is read again the moment something is decided", async () => {
    const home = homeFor(["reports.view", "sales.approve"]);
    await renderAs(["reports.view", "sales.approve"], <ModuleTabs module={home} activeTab={home.tabs[0]} />);
    await screen.findByRole("link", { name: /Approvals.*4 waiting/ });
    m.count.mockResolvedValue({ count: 3, others: 1 });
    act(() => announceApprovalsChanged());
    expect(await screen.findByRole("link", { name: /Approvals.*3 waiting/ })).toBeInTheDocument();
    expect(m.count).toHaveBeenCalledTimes(2);
  });

  it("caps what it draws at 99+", async () => {
    m.count.mockResolvedValue({ count: 240, others: 0 });
    const home = homeFor(["reports.view", "sales.approve"]);
    await renderAs(["reports.view", "sales.approve"], <ModuleTabs module={home} activeTab={home.tabs[0]} />);
    expect(await screen.findByText("99+")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /240 waiting/ })).toBeInTheDocument(); // the real number is for the screen reader
  });
});

describe("everywhere the navigation names the tab", () => {
  const GRANTS = ["reports.view", "sales.approve"];

  it("the rail shows the module's total on its entry", async () => {
    await renderAs(GRANTS, <AppRail modules={[homeFor(GRANTS)]} activeModuleId="home" />);
    expect(await screen.findByRole("link", { name: /Home.*4 waiting/ })).toBeInTheDocument();
  });

  it("the bottom bar shows it on the module's button", async () => {
    await renderAs(GRANTS, <BottomNav primary={[homeFor(GRANTS)]} rest={[]} activeModuleId="home" onOpenMore={() => {}} />);
    expect(await screen.findByRole("link", { name: /Home.*4 waiting/ })).toBeInTheDocument();
  });

  it("the More sheet shows it beside the tab", async () => {
    await renderAs(GRANTS, <MoreSheet open onOpenChange={() => {}} modules={[homeFor(GRANTS)]} active={null} />);
    expect(await screen.findByRole("link", { name: /Approvals.*4 waiting/ })).toBeInTheDocument();
  });

  it("a module with nothing waiting behind it shows no number", async () => {
    const finance = getVisibleModules(statusFor(["finance.view", "finance.approve"])).find((x) => x.id === "finance");
    await renderAs(["finance.view", "finance.approve"], <AppRail modules={[finance]} activeModuleId="finance" />);
    await waitFor(() => expect(m.count).toHaveBeenCalled());
    expect(await screen.findByRole("link", { name: /Finance/ })).toBeInTheDocument(); // (the control: the entry is there, with no number)
    expect(screen.queryByText(/waiting/)).toBeNull();
  });
});

describe("the my-work count (process steps given to the person)", () => {
  const INVENTORY = MODULES.find((x) => x.id === "inventory");
  it("is shown beside Production where Production is switched on, and refreshed when a step changes", async () => {
    orgStatus = { ...statusFor(["inventory.view"]), features: { production: true } };
    render(
      <MemoryRouter>
        <OrganisationProvider>
          <Known />
          <NavBadgesProvider><ModuleTabs module={INVENTORY} activeTab={INVENTORY.tabs[0]} /></NavBadgesProvider>
        </OrganisationProvider>
      </MemoryRouter>
    );
    expect(await screen.findByRole("link", { name: /Production.*3 waiting/ })).toHaveAttribute("href", "/production");
    m.myWork.mockResolvedValue({ count: 1 });
    await act(async () => window.dispatchEvent(new Event("process-work-changed")));
    expect(await screen.findByRole("link", { name: /Production.*1 waiting/ })).toBeInTheDocument();
  });

  it("asks nothing where Production is not explicitly on", async () => {
    await renderAs(["inventory.view"], <ModuleTabs module={INVENTORY} activeTab={INVENTORY.tabs[0]} />);
    await waitFor(() => expect(m.count).not.toHaveBeenCalled());
    expect(m.myWork).not.toHaveBeenCalled();
  });
});

const CRM = MODULES.find((x) => x.id === "crm");

describe("the CRM follow-ups count", () => {
  it("is shown beside Follow-ups for somebody who holds the CRM, and refreshed when they act", async () => {
    m.crmCount.mockResolvedValue({ count: 2 });
    await renderAs(["crm.view"], <ModuleTabs module={CRM} activeTab={CRM.tabs[0]} />);
    expect(await screen.findByRole("link", { name: /Follow-ups.*2 waiting/ })).toHaveAttribute("href", "/crm/follow-ups");

    m.crmCount.mockResolvedValue({ count: 1 });
    await act(async () => window.dispatchEvent(new Event("crm-work-changed")));
    expect(await screen.findByRole("link", { name: /Follow-ups.*1 waiting/ })).toBeInTheDocument();
  });

  it("is not asked for by somebody whose organisation did not buy the CRM", async () => {
    // `can` is capped by what the organisation holds, so a person without crm.view asks nothing.
    await renderAs(["sales.view"], <ModuleTabs module={HOME} activeTab={HOME.tabs[0]} />);
    await waitFor(() => expect(m.unreadCount).toHaveBeenCalled());
    expect(m.crmCount).not.toHaveBeenCalled();
  });
});

// No navigation tab names this one - it only backs the bell in TopBar - so it is read with a bare probe.
function NotificationsProbe() {
  const count = useNavBadge("notifications");
  return <span data-testid="notifications-count">{count}</span>;
}

describe("the notifications count (everyone's own feed)", () => {
  it("is asked for any signed-in person, whatever their grants - a row's audience can be any permission", async () => {
    m.unreadCount.mockResolvedValue({ count: 2 });
    await renderAs(["sales.view"], <NotificationsProbe />);
    await waitFor(() => expect(m.unreadCount).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("notifications-count")).toHaveTextContent("2");
  });

  it("is read again the moment something changes it", async () => {
    m.unreadCount.mockResolvedValue({ count: 2 });
    await renderAs(["sales.view"], <NotificationsProbe />);
    await screen.findByText("2");
    m.unreadCount.mockResolvedValue({ count: 0 });
    await act(async () => announceNotificationsChanged());
    await waitFor(() => expect(m.unreadCount).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("0")).toBeInTheDocument();
  });

  it("shows nothing when the count cannot be read, rather than a wrong number", async () => {
    m.unreadCount.mockRejectedValue(new Error("offline"));
    await renderAs(["sales.view"], <NotificationsProbe />);
    await waitFor(() => expect(m.unreadCount).toHaveBeenCalled());
    expect(await screen.findByTestId("notifications-count")).toHaveTextContent("0");
  });
});
