# The three flow pictures

Use these on a slide, in a proposal, or on paper while you talk. Each says what moves when,
which is the question clients ask most. GitHub and VS Code draw them from the Mermaid text below;
the same text is in `diagrams/*.mmd`. PNG versions for slides are not made yet: rendering them
needs the free mermaid-cli tool, which is not installed here.

## 1. Order to cash

```mermaid
flowchart LR
  Q[Quotation] -->|customer says yes| O[Sales order]
  O --> D[Delivery note<br/>signed for]
  D -->|one click| I[Invoice approved]
  I --> S[Sent by email<br/>or WhatsApp]
  I --> P[Payment received]
  P --> R[Customer's balance,<br/>ageing, dashboard up to date]

  classDef quiet fill:#f4f2ee,stroke:#b9b2a5,color:#1d1b18;
  classDef posts fill:#1d1b18,stroke:#1d1b18,color:#ffffff;
  class Q,O,D,S,R quiet;
  class I,P posts;
```

**Say:** "Nothing in the books moves until the invoice is approved. Then everything moves at
once: stock, the customer's balance, the accounts and the VAT."

## 2. Purchase to pay

```mermaid
flowchart LR
  L[Low stock<br/>reorder report] --> PO[Purchase order]
  PO -->|truck arrives| G[Goods received<br/>short lines noted]
  G -->|supplier's bill| B[Purchase invoice approved]
  B --> C[Payment<br/>cash, transfer or cheque]
  B --> A[Stock in at cost,<br/>average updated]

  classDef quiet fill:#f4f2ee,stroke:#b9b2a5,color:#1d1b18;
  classDef posts fill:#1d1b18,stroke:#1d1b18,color:#ffffff;
  class L,PO,G,A quiet;
  class B,C posts;
```

**Say:** "You can't be billed for more than arrived, and the stock comes in at what it really
cost."

## 3. Month end

```mermaid
flowchart LR
  BK[Bank statement loaded<br/>and reconciled] --> CH[Cheques cleared<br/>or bounced]
  CH --> V[VAT return checked<br/>against the books]
  V --> M[Month checked<br/>and closed]
  M --> F[Statements ready:<br/>P&L, balance sheet, ageing]

  classDef quiet fill:#f4f2ee,stroke:#b9b2a5,color:#1d1b18;
  classDef posts fill:#1d1b18,stroke:#1d1b18,color:#ffffff;
  class BK,CH,V,F quiet;
  class M posts;
```

**Say:** "Before a month is closed Zarvia checks it for you, and once it is closed nobody can
post into it by mistake."

Dark boxes are the steps that post to the books or lock them; light boxes record without posting.
