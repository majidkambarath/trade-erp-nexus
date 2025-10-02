export const getColorFilter = (colorClass) => ({
  "text-emerald-700": "invert(34%) sepia(94%) saturate(1352%) hue-rotate(145deg) brightness(94%) contrast(101%)",
  "text-blue-700": "invert(35%) sepia(99%) saturate(1352%) hue-rotate(200deg) brightness(94%) contrast(101%)",
  "text-indigo-700": "invert(38%) sepia(99%) saturate(1352%) hue-rotate(230deg) brightness(94%) contrast(101%)",
  "text-purple-700": "invert(35%) sepia(99%) saturate(1352%) hue-rotate(280deg) brightness(94%) contrast(101%)",
}[colorClass] || "none");

export const SessionManager = {
  storage: {},
  key: (k) => `receipt_session_${k}`,
  get: (key) => SessionManager.storage[SessionManager.key(key)] ?? null,
  set: (key, value) => { SessionManager.storage[SessionManager.key(key)] = value; },
  remove: (key) => { delete SessionManager.storage[SessionManager.key(key)]; },
  clear: () => {
    Object.keys(SessionManager.storage).forEach((k) => {
      if (k.startsWith("receipt_session_")) delete SessionManager.storage[k];
    });
  },
};

export const asArray = (x) => (Array.isArray(x) ? x : []);

export const takeArray = (resp) => {
  if (!resp) return [];
  const d = resp.data;
  return Array.isArray(d) ? d : Array.isArray(d?.data) ? (d.data.data ?? d.data) : Array.isArray(d?.vouchers) ? d.vouchers : [];
};

export const displayMode = (mode) => {
  const modes = { cash: "Cash", bank: "Bank", cheque: "Cheque", online: "Online" };
  return modes[mode?.toLowerCase()] || mode || "Unknown";
};

export const badgeClassForMode = (mode) => {
  const m = displayMode(mode);
  return {
    Cash: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    Bank: "bg-blue-100 text-blue-800 border border-blue-200",
    Cheque: "bg-purple-100 text-purple-800 border border-purple-200",
    Online: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  }[m] || "bg-slate-100 text-slate-800 border border-slate-200";
};

export const iconForMode = (mode, LucideIcons) => {
  const m = displayMode(mode);
  const { DollarSign, Building, FileText, CreditCard } = LucideIcons;
  const map = {
    Cash: <DollarSign size={14} className="text-emerald-600" />,
    Bank: <Building size={14} className="text-blue-600" />,
    Cheque: <FileText size={14} className="text-purple-600" />,
    Online: <CreditCard size={14} className="text-indigo-600" />,
  };
  return map[m] || <DollarSign size={14} className="text-slate-600" />;
};

export const formatCurrency = (amount, colorClass = "text-gray-900") => {
  const numAmount = Number(amount) || 0;
  const absAmount = Math.abs(numAmount).toFixed(2);
  const isNegative = numAmount < 0;
  return (
    <span className={`inline-flex items-center ${colorClass}`}>
      {isNegative && "-"}<span className="mr-1">AED</span>{absAmount}
    </span>
  );
};

export const by = (v) => (typeof v === "string" ? v.toLowerCase() : v);