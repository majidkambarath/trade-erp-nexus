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
//
// The TRN is the exception to "the profile": it is entered once, under Settings > Business rules > Tax
// identity, and kept with the accounting settings (the same TRN the VAT return uses). The profile has no field
// for it, so reading only the profile left every printed tax invoice without the seller's TRN and the screen
// warning that it was missing. It is read from there, and the profile's own value, if an older record has
// one, still wins.
export const useCompanyProfile = () => {
  const [profile, setProfile] = useState(EMPTY);

  useEffect(() => {
    if (!getAccessToken()) return undefined;
    let active = true;
    // the TRN, from the accounting settings; a failure here must never blank the rest of the company
    const taxIdentity = axiosInstance
      .get("/accounting/settings")
      .then(({ data }) => String(data?.data?.profile?.trn || ""))
      .catch(() => "");
    axiosInstance
      .get("/profile/me")
      .then(async ({ data }) => {
        const trn = await taxIdentity;
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
          vatNumber: c.vatNumber || trn,
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
