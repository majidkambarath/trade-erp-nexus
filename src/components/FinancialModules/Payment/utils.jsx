import { Banknote, CreditCard, Landmark, Smartphone } from "lucide-react";

import dirham  from
export const asArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null) return Object.values(data);
  return [data];
};

export const takeArray = (response) => {
  if (!response?.data) return [];
  const d = response.data;
  if (Array.isArray(d)) return d;
  if (typeof d === "object" && d !== null) {
    if (d.data) return asArray(d.data);
    if (d.results) return asArray(d.results);
    return Object.values(d);
  }
  return [];
};

export const displayMode = (mode) => {
  if (!mode) return "Unknown";
  const m = mode.toLowerCase();
  if (m.includes("bank")) return "Bank Transfer";
  if (m.includes("cheque") || m.includes("check")) return "Cheque";
  if (m.includes("online") || m.includes("digital")) return "Online";
  return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
};

export const badgeClassForMode = (mode) => {
  const m = mode?.toLowerCase() || "";
  if (m.includes("bank")) return "bg-blue-100 text-blue-700";
  if (m.includes("cheque") || m.includes("check")) return "bg-green-100 text-green-700";
  if (m.includes("online") || m.includes("digital")) return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-700";
};

export const iconForMode = (mode) => {
  const m = mode?.toLowerCase() || "";
  if (m.includes("bank"))
    return <Landmark size={16} className="text-blue-600" />;
  if (m.includes("cheque") || m.includes("check"))
    return <Banknote size={16} className="text-green-600" />;
  if (m.includes("online") || m.includes("digital"))
    return <Smartphone size={16} className="text-purple-600" />;
  return <CreditCard size={16} className="text-gray-600" />;
};

export const formatCurrency = (amount, textClass = "text-gray-900") => {
  const num = Number(amount) || 0;
  return (
    <span className={textClass}>
      <img
        src="/dirham.svg"
        alt="AED"
        className="inline w-4 h-4 mr-1"
        style={{ filter: getColorFilter(textClass) }}
      />
      {num.toLocaleString("en-AE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
};

export const by = (value) => (typeof value === "string" ? value.toLowerCase() : value);

export const SessionManager = {
  get: (key) => {
    try {
      const value = sessionStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  remove: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};

export const isImage = (fileOrName) => {
  if (!fileOrName) return false;
  const name = typeof fileOrName === "string" ? fileOrName : fileOrName.name;
  return /\.(jpg|jpeg|png)$/i.test(name);
};

export const getFileName = (fileOrName) => {
  if (!fileOrName) return "Unknown file";
  return typeof fileOrName === "string"
    ? fileOrName.split("/").pop()
    : fileOrName.name;
};

export const getFileSize = (fileOrAttachment) => {
  if (!fileOrAttachment) return "Unknown size";
  const size = typeof fileOrAttachment === "object" && fileOrAttachment.size
    ? fileOrAttachment.size
    : fileOrAttachment.fileSize || 0;
  return size < 1024 * 1024
    ? `${(size / 1024).toFixed(2)} KB`
    : `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

export const getColorFilter = (textClass) => {
  if (textClass.includes("purple")) return "invert(44%) sepia(65%) saturate(1742%) hue-rotate(243deg) brightness(94%) contrast(88%)";
  if (textClass.includes("blue")) return "invert(34%) sepia(97%) saturate(1352%) hue-rotate(192deg) brightness(94%) contrast(89%)";
  if (textClass.includes("emerald")) return "invert(44%) sepia(33%) saturate(1042%) hue-rotate(123deg) brightness(94%) contrast(89%)";
  if (textClass.includes("indigo")) return "invert(34%) sepia(97%) saturate(1352%) hue-rotate(232deg) brightness(94%) contrast(89%)";
  return "invert(44%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)";
};