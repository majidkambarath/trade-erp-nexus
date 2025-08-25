export const getStatusColor = (status) => {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "PENDING":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "REJECTED":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export const getStatusIcon = (status) => {
  switch (status) {
    case "DRAFT":
      return <Edit3 className="w-3 h-3" />;
    case "PENDING":
      return <Clock className="w-3 h-3" />;
    case "APPROVED":
      return <CheckCircle className="w-3 h-3" />;
    case "REJECTED":
      return <XCircle className="w-3 h-3" />;
    default:
      return <FileText className="w-3 h-3" />;
  }
};

export const getPriorityColor = (priority) => {
  switch (priority) {
    case "High":
      return "bg-red-500";
    case "Medium":
      return "bg-yellow-500";
    case "Low":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

export const calculateTotals = (items) => {
  let subtotal = 0;
  let totalTax = 0;

  items.forEach((item) => {
    if (item.qty && item.rate) {
      const lineValue = parseFloat(item.qty) * parseFloat(item.rate);
      const taxAmount = (lineValue * parseFloat(item.taxPercent || 0)) / 100;
      subtotal += lineValue;
      totalTax += taxAmount;
    }
  });

  return {
    subtotal: subtotal.toFixed(2),
    tax: totalTax.toFixed(2),
    total: (subtotal + totalTax).toFixed(2),
  };
};