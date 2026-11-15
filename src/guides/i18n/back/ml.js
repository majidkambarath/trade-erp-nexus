// What each Malayalam line says, written back into English FROM THE MALAYALAM (not copied from the English source),
// so someone who reads no Malayalam can compare the meaning. Same keys as en.js. An aid for reviewers, drafted by the
// same AI that wrote the translation: it shows drift, it is not an independent native check.
import sell from "./sell/ml";
import buy from "./buy/ml";
import stock from "./stock/ml";
import money from "./money/ml";
import accounts from "./accounts/ml";
import reports from "./reports/ml";

export default {
  ...sell,
  ...buy,
  ...stock,
  ...money,
  ...accounts,
  ...reports,
  "flow.add-customer": { title: "Add a customer", text: "The person or company you sell to. You will choose them in every sales document." },
  "add-customer.open": { title: "Customers", text: "Customers are under [[Sales]]. We have opened the page." },
  "add-customer.add": { title: "Add the customer", text: "Press [[Add Customer]]." },
  "add-customer.name": { title: "Their name", text: "Type the name of the company or person in the way it should be printed on the invoice, for example {{Al Madina Fresh Supermarket LLC}}." },
  "add-customer.contact": { title: "Whom you deal with", text: "The person you speak to in their company." },
  "add-customer.phone": { title: "Phone", text: "A number on which they can be contacted. This can be given later too." },
  "add-customer.address": { title: "Billing address", text: "The address to which invoices are sent. It will be printed on every invoice for this customer." },
  "add-customer.taxtab": { title: "Tax details", text: "Open this tab if the customer is registered for tax." },
  "add-customer.vatstatus": { title: "Registered for tax?", text: "If the customer has a tax registration number, select [[Registered]]. If it is [[Not registered]], there is no number to give." },
  "add-customer.trn": { title: "Tax registration number", text: "Their TRN (GSTIN in India). It will be printed on the invoice and is needed for the VAT return." },
  "add-customer.credittab": { title: "Credit and terms", text: "Open this tab to say how much time they have to pay." },
  "add-customer.terms": { title: "Payment terms", text: "For example {{Net 30}}. Reports know from this when an invoice becomes late." },
  "add-customer.save": { title: "Save", text: "Press [[Add Customer]] to save. Anything can be changed later." },
  "add-customer.done": { title: "Customer added", text: "Now you can choose this customer in a quotation or invoice. Next: add a vendor, that is, those you buy from." },

  "flow.add-vendor": { title: "Add a vendor", text: "The person or company you buy from. You will choose them in every purchase." },
  "add-vendor.open": { title: "Vendors", text: "Vendors are under [[Purchase]]. We have opened the page." },
  "add-vendor.add": { title: "Add the vendor", text: "Press [[Add Vendor]]." },
  "add-vendor.name": { title: "Their name", text: "The name of the vendor's company, for example {{Gulf Grain Importers LLC}}." },
  "add-vendor.contact": { title: "Whom you deal with", text: "The person you contact at the vendor." },
  "add-vendor.address": { title: "Address", text: "The vendor's address." },
  "add-vendor.taxtab": { title: "Tax details", text: "Open this tab if the vendor is registered for tax." },
  "add-vendor.vatstatus": { title: "Registered for tax?", text: "If the vendor has a tax registration number, select [[Registered]]. If it is [[Not registered]], there is no number to give." },
  "add-vendor.trn": { title: "Tax registration number", text: "Their TRN. This is needed to claim back the VAT on their invoices." },
  "add-vendor.save": { title: "Save", text: "Press [[Add Vendor]] to save." },
  "add-vendor.done": { title: "Vendor added", text: "Now you can buy from this vendor. Next: add the goods you trade in, that is, stock items." },

  "flow.add-item": { title: "Add a stock item", text: "The product you buy and sell. Its stock and cost are tracked from the first purchase." },
  "add-item.open": { title: "Stock items", text: "Items are under [[Inventory]]. We have opened the page." },
  "add-item.add": { title: "Add the item", text: "Press [[Add Stock Item]]." },
  "add-item.name": { title: "Item name", text: "The name you use in documents, for example {{Basmati Rice 40kg Bag}}." },
  "add-item.category": { title: "Category", text: "Groups similar items together for reports. Select a category, or type a new one to add it." },
  "add-item.unit": { title: "Unit", text: "How you count it: bag, carton, piece, kilogram." },
  "add-item.cost": { title: "Purchase price", text: "What one unit usually costs you. After the first purchase Zarvia itself calculates the average cost." },
  "add-item.price": { title: "Selling price", text: "The amount you usually charge for one unit. It can be changed on each invoice." },
  "add-item.reorder": { title: "Reorder level", text: "When stock goes down to this number, the reorder report tells you to buy more." },
  "add-item.save": { title: "Save", text: "Press [[Add Item]] to save." },
  "add-item.done": { title: "Item added", text: "It starts with no stock. Stock arrives when you approve a purchase invoice." },
};
