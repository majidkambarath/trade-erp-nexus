// English wording of every guide. Key = "<flow id>.<step id>" for a step, "flow.<flow id>" for the flow itself.
// A step: { title, text }. Keep a card to two short sentences: the person is looking at a screen, not a manual.
// The other languages (ar.js, hi.js, ml.js) hold the SAME keys; guides.test.js fails when one is missing.

import sell from "./sell/en";
import buy from "./buy/en";
import stock from "./stock/en";
import money from "./money/en";
import accounts from "./accounts/en";

export default {
  ...sell,
  ...buy,
  ...stock,
  ...money,
  ...accounts,
  reviewed: true,

  ui: {
    guideMe: "Guide me",
    stepOf: (i, n) => `Step ${i} of ${n}`,
    next: "Next",
    back: "Back",
    skip: "Skip this step",
    stop: "Stop guide",
    optional: "Optional",
    lost: "I can't find this on your screen. It may be on another tab, or not available to you.",
    inReview: "Translation in review",
    language: "Language",
    menuTitle: "Guides for this screen",
    allGuides: "All guides",
    noneHere: "No guide for this screen yet.",
    finished: "Finished",
    start: "Start guide",
    minutes: (n) => `${n} min`,
    here: "this screen",
  },

  "flow.add-customer": { title: "Add a customer", text: "Someone you sell to. You will pick them on every sales document." },
  "add-customer.open": { title: "Customers", text: "Customers live under [[Sales]]. We have opened the page for you." },
  "add-customer.add": { title: "Add the customer", text: "Press [[Add Customer]]." },
  "add-customer.name": { title: "Their name", text: "Type the company or person's name as it should print on invoices, for example {{Al Madina Fresh Supermarket LLC}}." },
  "add-customer.contact": { title: "Who you deal with", text: "The person you speak to at their company." },
  "add-customer.phone": { title: "Phone", text: "A number you can reach them on. You can leave this for later." },
  "add-customer.address": { title: "Billing address", text: "Where invoices are addressed. It prints on every invoice to this customer." },
  "add-customer.taxtab": { title: "Tax details", text: "Open this tab if the customer is registered for tax." },
  "add-customer.vatstatus": { title: "Registered for tax?", text: "Choose [[Registered]] if the customer has a tax number. With [[Not registered]] there is no number to enter." },
  "add-customer.trn": { title: "Tax registration number", text: "Their TRN (or GSTIN in India). It prints on the invoice and is needed for the VAT return." },
  "add-customer.credittab": { title: "Credit and terms", text: "Open this tab to say how long they have to pay." },
  "add-customer.terms": { title: "Payment terms", text: "For example {{Net 30}}. Reports use it to tell you when an invoice is late." },
  "add-customer.save": { title: "Save", text: "Press [[Add Customer]] to save. You can change anything later." },
  "add-customer.done": { title: "Customer added", text: "You can now pick this customer on a quotation or invoice. Next: add a vendor, someone you buy from." },

  "flow.add-vendor": { title: "Add a vendor", text: "Someone you buy from. You will pick them on every purchase." },
  "add-vendor.open": { title: "Vendors", text: "Vendors live under [[Purchase]]. We have opened the page for you." },
  "add-vendor.add": { title: "Add the vendor", text: "Press [[Add Vendor]]." },
  "add-vendor.name": { title: "Their name", text: "The supplier's company name, for example {{Gulf Grain Importers LLC}}." },
  "add-vendor.contact": { title: "Who you deal with", text: "Your contact at the supplier." },
  "add-vendor.address": { title: "Address", text: "The supplier's address." },
  "add-vendor.taxtab": { title: "Tax details", text: "Open this tab if the supplier is registered for tax." },
  "add-vendor.vatstatus": { title: "Registered for tax?", text: "Choose [[Registered]] if the vendor has a tax number. With [[Not registered]] there is no number to enter." },
  "add-vendor.trn": { title: "Tax registration number", text: "Their TRN. You need it to claim the VAT on their invoices." },
  "add-vendor.save": { title: "Save", text: "Press [[Add Vendor]] to save." },
  "add-vendor.done": { title: "Vendor added", text: "You can now buy from this vendor. Next: add the things you trade, your stock items." },

  "flow.add-item": { title: "Add a stock item", text: "A product you buy and sell. Its stock and its cost are tracked from the first purchase." },
  "add-item.open": { title: "Stock items", text: "Items live under [[Inventory]]. We have opened the page for you." },
  "add-item.add": { title: "Add the item", text: "Press [[Add Stock Item]]." },
  "add-item.name": { title: "Item name", text: "What you call it on documents, for example {{Basmati Rice 40kg Bag}}." },
  "add-item.category": { title: "Category", text: "Groups similar items for reports. Choose one, or type a new one to add it." },
  "add-item.unit": { title: "Unit", text: "How you count it: bag, carton, piece, kilogram." },
  "add-item.cost": { title: "Purchase price", text: "What one unit usually costs you. After the first purchase Zarvia works out the average cost itself." },
  "add-item.price": { title: "Selling price", text: "What you usually charge for one unit. You can change it on each invoice." },
  "add-item.reorder": { title: "Reorder level", text: "When stock falls to this number, the reorder report tells you to buy more." },
  "add-item.save": { title: "Save", text: "Press [[Add Item]] to save." },
  "add-item.done": { title: "Item added", text: "It starts with no stock. Stock arrives when you approve a purchase invoice." },
};
