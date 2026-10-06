import { useEffect, useState } from "react";
import axiosInstance from "../../../axios/axios";
import { getAccessToken } from "../../../axios/session";

const EMPTY = {
  companyName: "",
  companyNameArabic: "",
  addressLine1: "",
  addressLine2: "",
  phoneNumber: "",
  email: "",
  website: "",
  vatNumber: "",
  logo: null,
  bankName: "",
  accountNumber: "",
  accountName: "",
  ibanNumber: "",
  swiftCode: "",
  branch: "",
};

// The company as set in Settings. A field nobody has filled in stays empty and is left off the
// printed page; the old sheets printed invented placeholders in its place.
export const useCompanyProfile = () => {
  const [profile, setProfile] = useState(EMPTY);

  useEffect(() => {
    if (!getAccessToken()) return undefined;
    let active = true;
    axiosInstance
      .get("/profile/me")
      .then(({ data }) => {
        if (!active || !data?.success) return;
        const c = data.data?.companyInfo || {};
        const bank = c.bankDetails || {};
        setProfile({
          companyName: c.companyName || "",
          companyNameArabic: c.companyNameArabic || "",
          addressLine1: c.addressLine1 || "",
          addressLine2: c.addressLine2 || "",
          phoneNumber: c.phoneNumber || "",
          email: c.emailAddress || "",
          website: c.website || "",
          vatNumber: c.vatNumber || "",
          logo: c.companyLogo?.url || null,
          bankName: bank.bankName || "",
          accountNumber: bank.accountNumber || "",
          accountName: bank.accountName || "",
          ibanNumber: bank.ibanNumber || "",
          swiftCode: bank.swiftCode || "",
          branch: c.branch || "",
        });
      })
      .catch((e) => console.error(e));
    return () => {
      active = false;
    };
  }, []);

  return profile;
};
