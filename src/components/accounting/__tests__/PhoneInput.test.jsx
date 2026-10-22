import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Field, PhoneInput } from "../kit";
import { setOrgLocale } from "../../../utils/orgLocale";

// The field itself: two boxes, one stored number. What it shows for a number already on file, and
// what it reports when either half is changed.

const number = () => screen.getByLabelText("Phone");
const code = () => screen.getByLabelText("Country dialling code");

function Form({ initial = "", ...rest }) {
  const [phone, setPhone] = useState(initial);
  return (
    <>
      <Field label="Phone">
        <PhoneInput value={phone} onChange={(e) => setPhone(e.target.value)} {...rest} />
      </Field>
      <output data-testid="stored">{phone}</output>
    </>
  );
}
const stored = () => screen.getByTestId("stored").textContent;

describe("the phone field", () => {
  beforeEach(() => {
    setOrgLocale({ currency: "AED", timezone: "Asia/Dubai", country: "AE" });
  });

  it("opens on the organisation's own country", () => {
    render(<Form />);
    expect(code()).toHaveValue(""); // a search select's own box is empty; the chosen code is its text
    expect(screen.getByText("+971")).toBeInTheDocument();
    expect(number()).toHaveValue("");
    expect(stored()).toBe(""); // nothing typed yet, so nothing stored: a dialling code alone is not a number
  });

  it("the box shows the dialling code alone: the country's name belongs to the list", () => {
    // The hint does not shrink and the label does, so in a box this narrow the country name would win
    // and "+971" - the thing actually chosen - would be squeezed out of sight (it read "United").
    render(<Form />);
    expect(screen.getByText("+971")).toBeInTheDocument();
    expect(screen.queryByText("United Arab Emirates")).not.toBeInTheDocument();
  });

  it("stores the whole number in one compact field", () => {
    render(<Form />);
    fireEvent.change(number(), { target: { value: "50 123 4567" } });
    expect(stored()).toBe("+971501234567");
  });

  it("drops the leading 0 a UAE number is written with", () => {
    render(<Form />);
    fireEvent.change(number(), { target: { value: "050 123 4567" } });
    expect(stored()).toBe("+971501234567");
  });

  it("shows a stored number in its two halves", () => {
    render(<Form initial="+919876543210" />);
    expect(screen.getByText("+91")).toBeInTheDocument();
    expect(number()).toHaveValue("9876543210");
  });

  it("keeps the number and changes only the code when another country is chosen", () => {
    render(<Form initial="+971501234567" />);
    // react-select: open the list, type, take the first match
    fireEvent.keyDown(code(), { key: "ArrowDown" });
    fireEvent.change(code(), { target: { value: "India" } });
    fireEvent.keyDown(code(), { key: "Enter" });
    expect(stored()).toBe("+91501234567");
    expect(number()).toHaveValue("501234567");
  });

  it("empties the stored number when the number is cleared, rather than leaving a bare dialling code", () => {
    render(<Form initial="+971501234567" />);
    fireEvent.change(number(), { target: { value: "" } });
    expect(stored()).toBe("");
    expect(screen.getByText("+971")).toBeInTheDocument(); // the country stays chosen
  });

  it("leaves a number saved before this field existed exactly as it was until somebody edits it", () => {
    render(<Form initial="050 111 2222" />);
    expect(number()).toHaveValue("050 111 2222"); // shown as it is
    expect(stored()).toBe("050 111 2222"); // and NOT rewritten on the way to the screen
    fireEvent.change(number(), { target: { value: "050 111 3333" } }); // the person edits it
    expect(stored()).toBe("+971501113333"); // and then it is stored the way everything else is
  });

  it("shows the spaces and the 0 as they are typed: the box is not the stored number", () => {
    render(<Form />);
    fireEvent.change(number(), { target: { value: "050 123 4567" } });
    expect(number()).toHaveValue("050 123 4567"); // what the person typed stays on the screen
    expect(stored()).toBe("+971501234567"); // what is saved is the compact form
  });

  it("tidies the box to what will be saved on the way out, so the two never disagree", () => {
    render(<Form />);
    fireEvent.change(number(), { target: { value: "050 123 4567" } });
    fireEvent.blur(number());
    expect(number()).toHaveValue("501234567");
  });

  it("takes no letters at all, rather than taking them and complaining later", () => {
    render(<Form />);
    fireEvent.change(number(), { target: { value: "call me" } });
    expect(number()).toHaveValue("");
    expect(stored()).toBe("");
  });

  it("a whole international number pasted into the number box moves the code box with it", () => {
    render(<Form />);
    fireEvent.change(number(), { target: { value: "+91 98765 43210" } });
    expect(screen.getByText("+91")).toBeInTheDocument();
    expect(number()).toHaveValue("9876543210");
    expect(stored()).toBe("+919876543210"); // and not +971 in front of an Indian number
  });

  it("an Indian organisation opens on +91", () => {
    setOrgLocale({ currency: "INR", timezone: "Asia/Kolkata", country: "IN" });
    render(<Form />);
    expect(screen.getByText("+91")).toBeInTheDocument();
    fireEvent.change(number(), { target: { value: "98765 43210" } });
    expect(stored()).toBe("+919876543210");
  });

  it("the label, the hint and the error belong to the number box: that is the one a person types in", () => {
    render(
      <Field label="Phone" hint="Where we ring them" error="That is too short for a phone number">
        <PhoneInput value="" onChange={vi.fn()} />
      </Field>
    );
    const box = screen.getByLabelText("Phone");
    expect(box).toHaveAttribute("type", "tel");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription(/Where we ring them|too short/);
  });

  it("passes its name through, for a form that reads the field's name off the event", () => {
    const onChange = vi.fn();
    render(<PhoneInput name="contactNo" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: /^$/ }) || screen.getAllByRole("textbox")[1], { target: { value: "501234567" } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].target).toMatchObject({ name: "contactNo", value: "+971501234567" });
  });
});
