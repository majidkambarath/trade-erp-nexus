export interface PurchaseOrder {
  id: string;
  transactionNo: string;
  vendorId: string;
  vendorName: string;
  date: string;
  deliveryDate: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  approvalStatus: string;
  totalAmount: string;
  items: Array<{
    itemId: string;
    description: string;
    qty: number;
    rate: number;
    taxPercent: number;
    lineTotal: number;
  }>;
  terms: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  grnGenerated: boolean;
  invoiceGenerated: boolean;
  priority: "High" | "Medium" | "Low";
}