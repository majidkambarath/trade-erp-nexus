import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DateInput, Field } from "../kit";
import { setDateFormat } from "../../../utils/format";

afterEach(() => setDateFormat("DD/MM/YYYY"));

function Harness({ initial = "2026-10-04", ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Field label="Date"><DateInput value={value} onChange={(e) => { setValue(e.target.value); props.onValue?.(e.target.value); }} {...props} /></Field>
      <output data-testid="iso">{value}</output>
    </>
  );
}
const box = () => screen.getByLabelText("Date");

describe("date field", () => {
  it("shows the date the way the person chose to read it, not the browser's regional format", () => {
    render(<Harness />);
    expect(box()).toHaveValue("04/10/2026");
    setDateFormat("DD MMM YYYY");
    render(<Harness initial="2026-12-25" />);
    expect(screen.getAllByLabelText("Date")[1]).toHaveValue("25 Dec 2026");
  });

  it("accepts a typed date in that format and reports it as YYYY-MM-DD", () => {
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    fireEvent.change(box(), { target: { value: "05/11/2026" } });
    expect(seen).toHaveBeenLastCalledWith("2026-11-05");
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-05");
    expect(box()).toHaveValue("05/11/2026");
  });

  it("reads month-first when that is the chosen format, and always accepts an ISO date", () => {
    setDateFormat("MM/DD/YYYY");
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    expect(box()).toHaveValue("10/04/2026");
    fireEvent.change(box(), { target: { value: "03/09/2026" } });
    expect(seen).toHaveBeenLastCalledWith("2026-03-09");
    fireEvent.change(box(), { target: { value: "2026-01-31" } });
    expect(seen).toHaveBeenLastCalledWith("2026-01-31");
  });

  it("does not report a half-typed or impossible date, marks it, and goes back to the last good date on leaving", () => {
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    fireEvent.change(box(), { target: { value: "31/02/2026" } });
    expect(seen).not.toHaveBeenCalled();
    expect(box()).toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(box());
    expect(box()).toHaveValue("04/10/2026");
    expect(box()).not.toHaveAttribute("aria-invalid");
  });

  it("does not rewrite what is being typed: in YYYY-MM-DD the 17th can be typed, and the text is tidied on leaving", () => {
    setDateFormat("YYYY-MM-DD");
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    // "2026-03-1" already reads as the 1st; the field must keep it as typed so the next digit makes "2026-03-17"
    fireEvent.change(box(), { target: { value: "2026-03-1" } });
    expect(seen).toHaveBeenLastCalledWith("2026-03-01");
    expect(box()).toHaveValue("2026-03-1");
    expect(box()).not.toHaveAttribute("aria-invalid");
    fireEvent.change(box(), { target: { value: "2026-03-17" } });
    expect(seen).toHaveBeenLastCalledWith("2026-03-17");
    expect(box()).toHaveValue("2026-03-17");
    // a short form is written out in full once the field is left
    fireEvent.change(box(), { target: { value: "2026-4-5" } });
    expect(box()).toHaveValue("2026-4-5");
    fireEvent.blur(box());
    expect(box()).toHaveValue("2026-04-05");
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-04-05");
  });

  it("writes a date typed with other separators or without leading zeros in the chosen format when the field is left", () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: "5.3.2026" } });
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-03-05");
    fireEvent.blur(box());
    expect(box()).toHaveValue("05/03/2026");
  });

  it("passes the allowed range to the calendar, and leaves explaining a date outside it to the form", () => {
    const seen = vi.fn();
    const { container } = render(<Harness onValue={seen} min="2026-10-01" max="2026-10-31" />);
    const calendar = container.querySelector('input[type="date"]');
    expect(calendar).toHaveAttribute("min", "2026-10-01");
    expect(calendar).toHaveAttribute("max", "2026-10-31");
    fireEvent.change(box(), { target: { value: "01/11/2026" } });
    expect(seen).toHaveBeenLastCalledWith("2026-11-01");
  });

  it("follows a value that changes from outside, such as a quick range", () => {
    const { rerender } = render(<DateInput value="2026-01-01" onChange={() => {}} aria-label="From" />);
    expect(screen.getByLabelText("From")).toHaveValue("01/01/2026");
    rerender(<DateInput value="2026-10-01" onChange={() => {}} aria-label="From" />);
    expect(screen.getByLabelText("From")).toHaveValue("01/10/2026");
  });

  it("can be cleared, and the calendar choice is reported too", () => {
    const seen = vi.fn();
    const { container } = render(<Harness onValue={seen} />);
    fireEvent.change(box(), { target: { value: "" } });
    expect(seen).toHaveBeenLastCalledWith("");
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: "2026-12-01" } });
    expect(seen).toHaveBeenLastCalledWith("2026-12-01");
    expect(box()).toHaveValue("01/12/2026");
  });

  it("offers the calendar as a button but keeps typing as the main way in", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Open calendar" })).toBeInTheDocument();
  });
});
