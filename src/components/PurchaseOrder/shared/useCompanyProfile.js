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

// The company as set in Settings: the ORGANISATION's one letterhead (GET /company/profile), the same for everyone who prints
// a document, not a copy kept by each person. A field nobody has filled in stays empty and is left off the printed page; the
// old sheets printed invented placeholders in its place.
//
// The TRN comes with it as `vatNumber`: it is entered once, under Settings > Business rules > Tax identity (the same TRN the
// VAT return uses), and the server hands it over here, so a printed tax invoice and the VAT return cannot disagree.
export const useCompanyProfile = () => {
  const [profile, setProfile] = useState(EMPTY);

  useEffect(() => {
    if (!getAccessToken()) return undefined;
    let active = true;
    axiosInstance
      .get("/company/profile")
      .then(({ data }) => {
        if (!active || !data?.success) return;
        const c = data.data || {};
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
