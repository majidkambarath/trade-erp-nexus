import { useState, useEffect } from "react";

const useVendorForm = (initialData = {}) => {
  const [formData, setFormData] = useState({
    vendorId: "",
    vendorName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    paymentTerms: "",
    taxId: "",
    ...initialData,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const generateVendorId = () => {
      const datePrefix = `VEND${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
      const randomSuffix = Math.floor(100 + Math.random() * 900).toString().padStart(3, "0");
      return `${datePrefix}-${randomSuffix}`;
    };
    if (!formData.vendorId) {
      setFormData((prev) => ({ ...prev, vendorId: generateVendorId() }));
    }
  }, [formData.vendorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.vendorName) newErrors.vendorName = "Vendor Name is required";
    if (!formData.contactPerson) newErrors.contactPerson = "Contact Person is required";
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email))
      newErrors.email = "Invalid email format";
    if (formData.phone && !/^\+?\d{10,}$/.test(formData.phone))
      newErrors.phone = "Invalid phone number";
    if (!formData.address) newErrors.address = "Address is required";
    return newErrors;
  };

  return { formData, errors, isSubmitting, setFormData, setErrors, setIsSubmitting, handleChange, validateForm };
};

export default useVendorForm;