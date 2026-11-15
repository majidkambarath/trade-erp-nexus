// What each Hindi line says, written back into English FROM THE HINDI (not copied from the English source), so
// someone who reads no Hindi can compare the meaning. Same keys as en.js. An aid for reviewers, drafted by the same
// AI that wrote the translation: it shows drift, it is not an independent native check.
import sell from "./sell/hi";
import buy from "./buy/hi";
import stock from "./stock/hi";
import money from "./money/hi";
import accounts from "./accounts/hi";

export default {
  ...sell,
  ...buy,
  ...stock,
  ...money,
  ...accounts,
  "flow.add-customer": { title: "Add a customer", text: "The person or company you sell to. You will choose them in every sales document." },
  "add-customer.open": { title: "Customers", text: "Customers are under [[Sales]]. We have opened the page for you." },
  "add-customer.add": { title: "Add a customer", text: "Press [[Add Customer]]." },
  "add-customer.name": { title: "Their name", text: "Write the name of the company or person the way it should be printed on the invoice, like {{Al Madina Fresh Supermarket LLC}}." },
  "add-customer.contact": { title: "Who you talk to", text: "The person at their company whom you talk to." },
  "add-customer.phone": { title: "Phone", text: "A number on which you can reach them. You can fill this in later too." },
  "add-customer.address": { title: "Billing address", text: "Where invoices are sent. It is printed on every invoice of this customer." },
  "add-customer.taxtab": { title: "Tax details", text: "Open this tab if the customer is registered for tax." },
  "add-customer.vatstatus": { title: "Are they registered for tax?", text: "If the customer has a tax registration number, choose [[Registered]]. When you choose [[Not registered]], there is no number to enter." },
  "add-customer.trn": { title: "Tax registration number", text: "Their TRN (GSTIN in India). It is printed on the invoice and is necessary for the VAT return." },
  "add-customer.credittab": { title: "Credit and terms", text: "Open this tab to say how much time they get for payment." },
  "add-customer.terms": { title: "Payment terms", text: "For example {{Net 30}}. Reports use this to tell when an invoice becomes late." },
  "add-customer.save": { title: "Save", text: "Press [[Add Customer]] to save. You can change anything later." },
  "add-customer.done": { title: "Customer added", text: "You can now choose this customer in a quotation or invoice. Next: add a vendor, that is, the one you buy from." },

  "flow.add-vendor": { title: "Add a vendor", text: "The one you buy from. You will choose them in every purchase." },
  "add-vendor.open": { title: "Vendors", text: "Vendors are under [[Purchase]]. We have opened the page for you." },
  "add-vendor.add": { title: "Add a vendor", text: "Press [[Add Vendor]]." },
  "add-vendor.name": { title: "Their name", text: "The name of the vendor's company, like {{Gulf Grain Importers LLC}}." },
  "add-vendor.contact": { title: "Who you talk to", text: "Your contact person at the vendor's." },
  "add-vendor.address": { title: "Address", text: "The vendor's address." },
  "add-vendor.taxtab": { title: "Tax details", text: "Open this tab if the vendor is registered for tax." },
  "add-vendor.vatstatus": { title: "Are they registered for tax?", text: "If the vendor has a tax registration number, choose [[Registered]]. When you choose [[Not registered]], there is no number to enter." },
  "add-vendor.trn": { title: "Tax registration number", text: "Their TRN. You need this to take back the VAT charged on their invoices." },
  "add-vendor.save": { title: "Save", text: "Press [[Add Vendor]] to save." },
  "add-vendor.done": { title: "Vendor added", text: "You can now buy from this vendor. Next: add the things you trade in, that is, stock items." },

  "flow.add-item": { title: "Add a stock item", text: "The product you buy and sell. Its stock and cost are tracked from the very first purchase." },
  "add-item.open": { title: "Stock items", text: "Items are under [[Inventory]]. We have opened the page for you." },
  "add-item.add": { title: "Add an item", text: "Press [[Add Stock Item]]." },
  "add-item.name": { title: "Item name", text: "The name you call it by in documents, like {{Basmati Rice 40kg Bag}}." },
  "add-item.category": { title: "Category", text: "Keeps similar items together in reports. Choose a category, or write a new one to add it." },
  "add-item.unit": { title: "Unit", text: "How you count it: sack, carton, piece, kilogram." },
  "add-item.cost": { title: "Purchase price", text: "What one unit usually costs you. After the first purchase Zarvia works out the average cost by itself." },
  "add-item.price": { title: "Selling price", text: "What you usually charge for one unit. You can change it on every invoice." },
  "add-item.reorder": { title: "Reorder level", text: "When stock falls to this number, the reorder report tells you to buy more." },
  "add-item.save": { title: "Save", text: "Press [[Add Item]] to save." },
  "add-item.done": { title: "Item added", text: "It starts without stock. Stock comes when you approve a purchase invoice." },
};
