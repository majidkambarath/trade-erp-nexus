import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AmountInput } from "../kit";
import { formatCurrencyAED, formatNumber } from "../../../utils/format";
import { resetOrgLocale, setOrgLocale } from "../../../utils/orgLocale";

// An amount is typed with the grouping the ORGANISATION's country uses, and what the form keeps is the
// plain number, so a form that stores and sends the value it is handed needs no change.

function Form({ onValue }) {
  const [value, setValue] = useState("");
  return (
    <>
      <label htmlFor="price">Purchase Price</label>
      <AmountInput
        id="price"
        name="purchasePrice"
        value={value}
        min={0}
        onChange={(e) => {
          setValue(e.target.value);
          onValue?.(e.target.value);
        }}
      />
      <p data-testid="stored">{value}</p>
    </>
  );
}

// key by key, the way a browser does it: each keystroke arrives as the whole field, the character
// added where the caret is (at the end here), on top of whatever the field is showing at that moment.
function type(field, text) {
  for (const ch of text) {
    fireEvent.change(field, { target: { value: field.value + ch, selectionStart: field.value.length + 1 } });
  }
}

afterEach(() => resetOrgLocale());

describe("typing an amount", () => {
  it("draws the commas as the number grows and stores the plain number", () => {
    render(<Form />);
    const field = screen.getByLabelText("Purchase Price");
    type(field, "20000");
    expect(field).toHaveValue("20,000");
    expect(screen.getByTestId("stored")).toHaveTextContent("20000");
  });

  it("takes decimals, and keeps a trailing zero while it is being typed", () => {
    render(<Form />);
    const field = screen.getByLabelText("Purchase Price");
    type(field, "1234.50");
    expect(field).toHaveValue("1,234.50");
    expect(screen.getByTestId("stored")).toHaveTextContent("1234.50");
  });

  it("refuses letters and a minus where the figure cannot be negative", () => {
    render(<Form />);
    const field = screen.getByLabelText("Purchase Price");
    type(field, "-1a2b3");
    expect(field).toHaveValue("123");
  });

  it("takes a pasted amount with its grouping and currency", () => {
    render(<Form />);
    const field = screen.getByLabelText("Purchase Price");
    fireEvent.change(field, { target: { value: "AED 1,250,000.75" } });
    expect(field).toHaveValue("1,250,000.75");
    expect(screen.getByTestId("stored")).toHaveTextContent("1250000.75");
  });

  it("is a numeric keypad on a phone, not a spinner", () => {
    render(<Form />);
    const field = screen.getByLabelText("Purchase Price");
    expect(field).toHaveAttribute("inputmode", "decimal");
    expect(field).toHaveAttribute("type", "text"); // a number input cannot hold a comma at all
  });
});

describe("the grouping is the organisation's country's", () => {
  it("groups in lakhs for an Indian organisation, and so does every figure beside it", async () => {
    setOrgLocale({ country: "IN", currency: "INR", timezone: "Asia/Calcutta" });
    render(<Form />);
    const field = screen.getByLabelText("Purchase Price");
    type(field, "120000");
    expect(field).toHaveValue("1,20,000");
    expect(screen.getByTestId("stored")).toHaveTextContent("120000");
    expect(formatNumber(120000)).toBe("1,20,000.00");
    expect(formatCurrencyAED(120000)).toContain("1,20,000.00");
  });

  it("groups in thousands in the UAE", async () => {
    setOrgLocale({ country: "AE", currency: "AED", timezone: "Asia/Dubai" });
    render(<Form />);
    type(screen.getByLabelText("Purchase Price"), "120000");
    expect(screen.getByLabelText("Purchase Price")).toHaveValue("120,000");
    expect(formatNumber(120000)).toBe("120,000.00");
  });
});
