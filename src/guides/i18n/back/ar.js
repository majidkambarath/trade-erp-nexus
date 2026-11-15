// What each Arabic line says, written back into English FROM THE ARABIC (not copied from the English source), so
// someone who reads no Arabic can compare the meaning. Same keys as en.js. This is an aid for reviewers, drafted by
// the same AI that wrote the translation: it shows drift, it is not an independent native check.
import sell from "./sell/ar";
import buy from "./buy/ar";
import stock from "./stock/ar";

export default {
  ...sell,
  ...buy,
  ...stock,
  "flow.add-customer": { title: "Adding a customer", text: "A person or a company you sell to. You will choose them in every sales document." },
  "add-customer.open": { title: "Customers", text: "Customers are under [[Sales]]. We opened the page for you." },
  "add-customer.add": { title: "Add the customer", text: "Press [[Add Customer]]." },
  "add-customer.name": { title: "Their name", text: "Write the name of the company or person as you want it to appear on invoices, such as {{Al Madina Fresh Supermarket LLC}}." },
  "add-customer.contact": { title: "The person you deal with", text: "The person you communicate with at their company." },
  "add-customer.phone": { title: "Phone", text: "A number you can call. You can leave it for later." },
  "add-customer.address": { title: "Invoice address", text: "The address that invoices are directed to. It appears on every invoice for this customer." },
  "add-customer.taxtab": { title: "Tax details", text: "Open this tab if the customer is registered for tax." },
  "add-customer.vatstatus": { title: "Is it registered for tax?", text: "Choose [[Registered]] if the customer has a tax registration number. With [[Not registered]] there is no number to enter." },
  "add-customer.trn": { title: "Tax registration number", text: "Their TRN number (or GSTIN in India). It appears on the invoice and is required for the value added tax return." },
  "add-customer.credittab": { title: "Credit and terms", text: "Open this tab to set the period allowed for payment." },
  "add-customer.terms": { title: "Payment terms", text: "For example {{Net 30}}. Reports use them to know when an invoice becomes late." },
  "add-customer.save": { title: "Save", text: "Press [[Add Customer]] to save. You can change anything later." },
  "add-customer.done": { title: "The customer was added", text: "You can now choose this customer in a price offer or an invoice. Next: add a supplier, that is, a party you buy from." },

  "flow.add-vendor": { title: "Adding a supplier", text: "A party you buy from. You will choose it in every purchase." },
  "add-vendor.open": { title: "Suppliers", text: "Suppliers are under [[Purchase]]. We opened the page for you." },
  "add-vendor.add": { title: "Add the supplier", text: "Press [[Add Vendor]]." },
  "add-vendor.name": { title: "Their name", text: "The name of the supplier's company, such as {{Gulf Grain Importers LLC}}." },
  "add-vendor.contact": { title: "The person you deal with", text: "Your contact person at the supplier's company." },
  "add-vendor.address": { title: "Address", text: "The supplier's address." },
  "add-vendor.taxtab": { title: "Tax details", text: "Open this tab if the supplier is registered for tax." },
  "add-vendor.vatstatus": { title: "Is it registered for tax?", text: "Choose [[Registered]] if the supplier has a tax registration number. With [[Not registered]] there is no number to enter." },
  "add-vendor.trn": { title: "Tax registration number", text: "Their TRN number. You need it to recover the value added tax on their invoices." },
  "add-vendor.save": { title: "Save", text: "Press [[Add Vendor]] to save." },
  "add-vendor.done": { title: "The supplier was added", text: "You can now buy from this supplier. Next: add what you trade in, that is, stock items." },

  "flow.add-item": { title: "Adding a stock item", text: "A product you buy and sell. Its stock and its cost are tracked from the first purchase." },
  "add-item.open": { title: "Stock items", text: "Items are under [[Inventory]]. We opened the page for you." },
  "add-item.add": { title: "Add the item", text: "Press [[Add Stock Item]]." },
  "add-item.name": { title: "Item name", text: "The name you use in documents, such as {{Basmati Rice 40kg Bag}}." },
  "add-item.category": { title: "Category", text: "Groups similar items in reports. Choose a category or write a new one to add it." },
  "add-item.unit": { title: "Unit", text: "How you count it: bag, carton, piece, kilogram." },
  "add-item.cost": { title: "Purchase price", text: "What one unit usually costs you. After the first purchase Zarvia calculates the average cost itself." },
  "add-item.price": { title: "Selling price", text: "What you usually charge for one unit. You can change it on each invoice." },
  "add-item.reorder": { title: "Reorder limit", text: "When the stock drops to this number, the reorder report tells you to buy." },
  "add-item.save": { title: "Save", text: "Press [[Add Item]] to save." },
  "add-item.done": { title: "The item was added", text: "It starts with no stock. Stock arrives when a purchase invoice is approved." },
};
