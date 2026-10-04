import OrderForm from "../../OrderEntry/OrderForm";
import { VARIANTS } from "../../OrderEntry/variants";

// Purchase return entry. Picking an approved purchase order prefills the lines; the form
// itself is the shared OrderEntry component configured for a purchase return.
export default function POForm({
  formData,
  setFormData,
  vendors,
  stockItems,
  addNotification,
  selectedPO,
  setActiveView,
  setPurchaseOrders,
  resetForm,
  onPOSuccess,
  activeView,
}) {
  return (
    <OrderForm
      variant={VARIANTS.purchaseReturn}
      formData={formData}
      setFormData={setFormData}
      parties={vendors}
      stockItems={stockItems}
      notify={addNotification}
      selected={selectedPO}
      setActiveView={setActiveView}
      setList={setPurchaseOrders}
      resetForm={resetForm}
      onSuccess={onPOSuccess}
      activeView={activeView}
    />
  );
}
