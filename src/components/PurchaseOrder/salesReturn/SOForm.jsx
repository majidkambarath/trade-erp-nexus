import OrderForm from "../../OrderEntry/OrderForm";
import { VARIANTS } from "../../OrderEntry/variants";

// Sales return entry. The shared OrderEntry component configured for a sales return.
export default function SOForm({
  formData,
  setFormData,
  customers,
  stockItems,
  addNotification,
  selectedSO,
  setActiveView,
  setSalesReturnOrders,
  resetForm,
  onSOSuccess,
  activeView,
}) {
  return (
    <OrderForm
      variant={VARIANTS.salesReturn}
      formData={formData}
      setFormData={setFormData}
      parties={customers}
      stockItems={stockItems}
      notify={addNotification}
      selected={selectedSO}
      setActiveView={setActiveView}
      setList={setSalesReturnOrders}
      resetForm={resetForm}
      onSuccess={onSOSuccess}
      activeView={activeView}
    />
  );
}
