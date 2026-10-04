import OrderForm from "../../OrderEntry/OrderForm";
import { VARIANTS } from "../../OrderEntry/variants";

// Sales order entry. The shared OrderEntry component configured for a sales order.
export default function SOForm({
  formData,
  setFormData,
  customers,
  stockItems,
  addNotification,
  selectedSO,
  setActiveView,
  setSalesOrders,
  resetForm,
  onSOSuccess,
  activeView,
}) {
  return (
    <OrderForm
      variant={VARIANTS.sales}
      formData={formData}
      setFormData={setFormData}
      parties={customers}
      stockItems={stockItems}
      notify={addNotification}
      selected={selectedSO}
      setActiveView={setActiveView}
      setList={setSalesOrders}
      resetForm={resetForm}
      onSuccess={onSOSuccess}
      activeView={activeView}
    />
  );
}
