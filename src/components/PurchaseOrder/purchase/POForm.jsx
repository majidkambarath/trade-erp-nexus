import OrderForm from "../../OrderEntry/OrderForm";
import { VARIANTS } from "../../OrderEntry/variants";

// Purchase order entry. The page keeps its list and state; the form is the shared
// OrderEntry component configured for a purchase order.
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
      variant={VARIANTS.purchase}
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
