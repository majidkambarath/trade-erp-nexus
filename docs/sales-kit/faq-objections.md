# Questions clients ask, and true answers

Short answers you can say out loud. Where something is not built, the answer says so. A client
who hears "not yet" from you will trust everything else you say. Anything not answered here goes
to the product team before you reply. Do not guess.

## Getting started

**Can we bring our data from Tally or Excel?**
Customers, suppliers and items are set up on screen. The go-live position is typed into the
**Opening balances** screen: account balances, each customer's and supplier's unpaid invoices,
and opening stock with its cost. There is no spreadsheet import for these yet. If the client has
a very long list (thousands of items), ask the product team how it will be loaded before you
promise anything.

**How long does it take to go live?**
It depends on how clean their lists are and how many people need training. Do not promise a
number of days; the product team confirms it. [client-journey.md](client-journey.md) lists the
steps.

**Do we need to install anything?**
No. It runs in the browser on a computer, a tablet or a phone, and it can be installed on a
phone like an app.

**Does it work without internet?**
No. It needs a connection.

## VAT and the law

**Is it ready for UAE VAT?**
Yes. Tax codes for standard, zero-rated, exempt and reverse charge. A tax invoice carries the
"Tax invoice" heading, your TRN and the customer's VAT status. The VAT 201 return is built box by
box from the approved documents and checked against the VAT accounts. A finalised return locks
its period.

**Does it file the VAT return with the FTA?**
No. Zarvia prepares the figures; you submit them on the FTA's own portal and record the
reference in Zarvia.

**What about e-invoicing (the UAE mandate)?**
The e-invoice format the UAE uses (PINT AE) is built and tested against a test service. The
connection to an accredited service provider, which is what actually sends an e-invoice, is not
live yet. **Do not promise a date.** See [do-not-promise.md](do-not-promise.md).

**Corporate tax?**
Zarvia does not calculate corporate tax. The profit and loss and the balance sheet give your
accountant the figures.

**Can the invoice be in Arabic?**
The company name prints in English and Arabic on the letterhead. The rest of the document, and
the whole screen, is in English.

## How it works

**Does it stop us selling stock we don't have?**
It shows the stock on hand while you type the line. It warns; it does not block. A sale can take
stock below zero; it is costed at the last average cost, and the stock reports show it.

**How is stock costed?**
Weighted average. A purchase updates the average; a sale takes stock out at the average.

**More than one warehouse?**
No. Zarvia keeps one stock figure per item for the whole company.

**More than one branch?**
Yes, on Premium. Each branch has its own documents, numbering and books view; customers, items
and the chart of accounts are shared. Stock is still one figure for the whole company.

**Batches and expiry dates?**
Yes. Each batch has its expiry, and sales take the earliest expiry first.

**Can we sell services as well as goods (delivery, labour, installation)?**
Yes. A service is an item with no stock, posted to its own income account.

**Foreign currency?**
Receipts and payments can be in a foreign currency at a stated rate. Invoices are in the
company's own currency (AED).

**Credit limits?**
Yes. Zarvia warns before a sale takes a customer past their limit; only people you allow can go
past it.

**Post-dated cheques?**
Yes. Each cheque is followed from in hand to deposited to cleared, or bounced with the reason.
A bounced cheque opens again the invoices it paid. Zarvia reminds you of cheques falling due.

**Bank reconciliation?**
Yes, on Premium. Download the statement from your bank (Excel, CSV or MT940) and load it;
Zarvia suggests the matches. There is no live connection to the bank.

**Card payments?**
Yes, with each card type's fee. Matching the bank's settlement to the card sales is part of
bank reconciliation, so it is on Premium.

**Who approves what?**
You decide per role: who can approve, up to what amount, and whether amounts over a limit need
a second person. You can also require that the person who prepared a document cannot approve it.

**Can a mistake be deleted?**
A draft, yes. An approved invoice is corrected with a credit note or a return. Deleting an
approved one is a separate permission you give to very few people, and it reverses everything
it posted. Everything is in the audit trail either way.

**Month end and year end?**
A month can be checked and closed (locked). Closing the year moves the profit to retained
earnings and locks it. Both can be reopened by someone with the right permission.

**What reports are there?**
Profit and loss with gross profit, balance sheet against last year, cash flow, trial balance,
general ledger, day book, cash and bank book, ageing, customer and supplier statements (PDF),
sales and purchase analysis by customer, item and month, stock valuation, movement, reorder and
batch expiry, and the VAT return. They can be exported, with your company name and the period
printed on top.

**Can we change the invoice layout or add our own fields?**
Your logo, letterhead, Arabic name, bank details, terms and the numbering of each document type
are yours to set. A different invoice layout, and fields of your own, are not built. See
[do-not-promise.md](do-not-promise.md).

## Security and data

**Who can see our data?**
Only your people, and each person only what their role allows. Every company's data is kept apart
from every other company's. Two-step sign-in is available for everyone or for chosen people.
Every document records who made it, changed it and approved it.

**Where is the data kept? Is it backed up?**
The product team confirms the hosting and backup arrangement for each contract. Do not name a
country, a provider or a backup schedule yourself.

**What if someone forgets their password?**
They reset it from the sign-in page by email, once email is set up for their company's
installation. Otherwise an administrator in the company sets a new one.

## Other modules (not part of the ERP demo)

**Payroll and HR? A CRM?**
Both exist as separate parts of Zarvia, on Premium or on their own plans. They are not in this
demo. If the client asks, say yes, they exist, and book a separate session with the product team.

**We manufacture / we run a garage.**
Zarvia has a production module (materials and expenses into a product's cost, job work, process
steps) and a garage module (job cards, vehicles, insurance claims). Both are switched on per
client. Book a separate demo; this one is for trading.

## Price and support

**How much is it?**
Use the price list you were given. Zarvia AI in the app never quotes prices.

**What support do we get?**
In the app, Zarvia AI answers "how do I…" questions from the product's help. The short videos
and click-through demos show each task. Human support is part of the contract; check its terms
with the product team.
