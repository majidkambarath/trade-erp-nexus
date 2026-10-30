import React, { useState } from "react";
import { Button } from "../ui/button";
import { vehicles, partyChoices } from "../../lib/garageApi";
import { garageErrorText } from "../../lib/garage";
import { AmountInput, DateInput, ErrorNote, Field, Modal, QuickAddSelect, Select, TextInput, useAsync } from "../accounting/kit";

// Add or edit a vehicle (Garage > Vehicles). The same form both ways: `vehicle` present means edit.
export default function VehicleForm({ vehicle, onClose, onSaved }) {
  const editing = Boolean(vehicle?._id);
  const customers = useAsync(() => partyChoices.customers({ limit: 500 }), []);
  // Suggestions only, from what this workshop has already typed (vehicleService.catalogue) - free text stays
  // free text, so "Toyota" and "toyota" are offered side by side rather than one being silently corrected.
  const catalogue = useAsync(() => vehicles.catalogue(), []);
  const customerOptions = (customers.data || []).map((c) => ({ value: c.id, label: c.name, hint: c.code }));
  const createCustomer = async (name) => {
    const c = await partyChoices.createCustomer(name);
    return { value: c.id, label: c.name };
  };

  const [form, setForm] = useState({
    plateNumber: vehicle?.plateNumber || "",
    plateCode: vehicle?.plateCode || "",
    plateEmirate: vehicle?.plateEmirate || "",
    chassisNo: vehicle?.chassisNo || "",
    engineNo: vehicle?.engineNo || "",
    make: vehicle?.make || "",
    model: vehicle?.model || "",
    variant: vehicle?.variant || "",
    year: vehicle?.year ? String(vehicle.year) : "",
    colour: vehicle?.colour || "",
    transmission: vehicle?.transmission || "",
    fuelType: vehicle?.fuelType || "",
    customerId: vehicle?.customerId ? String(vehicle.customerId?._id || vehicle.customerId) : "",
    odometer: vehicle?.odometer ? String(vehicle.odometer) : "",
    registrationExpiry: vehicle?.registrationExpiry ? String(vehicle.registrationExpiry).slice(0, 10) : "",
    notes: vehicle?.notes || "",
  });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setField = (k) => (e) => set(k)(e?.target ? e.target.value : e);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  const missing = !form.plateNumber.trim() && !form.chassisNo.trim();

  async function submit() {
    if (missing || !form.make.trim() || !form.model.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = { ...form, year: form.year === "" ? "" : Number(form.year), odometer: form.odometer === "" ? "" : Number(form.odometer) };
      const v = editing ? await vehicles.update(vehicle._id, body) : await vehicles.create(body);
      onSaved(v, `${v.plateNumber || v.chassisNo} saved.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title={editing ? `Edit ${vehicle.plateNumber || vehicle.chassisNo}` : "New vehicle"}
      description="Identified by its plate or its chassis, however either is typed."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Plate number" error={missing ? "Enter the plate, or the chassis if there is no plate yet" : undefined} className="col-span-2">
            <TextInput value={form.plateNumber} onChange={setField("plateNumber")} placeholder="A 12345" autoFocus />
          </Field>
          <Field label="Code"><TextInput value={form.plateCode} onChange={setField("plateCode")} /></Field>
          <Field label="Emirate"><TextInput value={form.plateEmirate} onChange={setField("plateEmirate")} placeholder="Dubai" /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Chassis (VIN)"><TextInput value={form.chassisNo} onChange={setField("chassisNo")} /></Field>
          <Field label="Engine number"><TextInput value={form.engineNo} onChange={setField("engineNo")} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Make" required error={!form.make.trim() ? "Required" : undefined}>
            <TextInput value={form.make} onChange={setField("make")} placeholder="Toyota" list="garage-vehicle-makes" />
          </Field>
          <Field label="Model" required error={!form.model.trim() ? "Required" : undefined}>
            <TextInput value={form.model} onChange={setField("model")} placeholder="Hilux" list="garage-vehicle-models" />
          </Field>
          <datalist id="garage-vehicle-makes">{(catalogue.data?.makes || []).map((m) => <option key={m} value={m} />)}</datalist>
          <datalist id="garage-vehicle-models">{(catalogue.data?.modelsByMake?.[form.make] || [...new Set(Object.values(catalogue.data?.modelsByMake || {}).flat())]).map((m) => <option key={m} value={m} />)}</datalist>
          <Field label="Variant"><TextInput value={form.variant} onChange={setField("variant")} /></Field>
          <Field label="Year"><TextInput type="number" value={form.year} onChange={setField("year")} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Colour"><TextInput value={form.colour} onChange={setField("colour")} /></Field>
          <Field label="Transmission">
            <Select value={form.transmission} onChange={setField("transmission")}>
              <option value="">–</option>
              <option value="manual">Manual</option>
              <option value="automatic">Automatic</option>
            </Select>
          </Field>
          <Field label="Fuel">
            <Select value={form.fuelType} onChange={setField("fuelType")}>
              <option value="">–</option>
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="hybrid">Hybrid</option>
              <option value="electric">Electric</option>
            </Select>
          </Field>
        </div>

        <Field label="Owner" hint="The current owner. Changing it closes the old owner's history and opens a new one.">
          <QuickAddSelect
            value={form.customerId}
            onChange={set("customerId")}
            options={customerOptions}
            onCreate={createCustomer}
            onCreated={customers.reload}
            loading={customers.loading}
            placeholder="Choose or add the customer…"
            clearable
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Odometer (km)"><AmountInput value={form.odometer} onChange={setField("odometer")} min="0" allowNegative /></Field>
          <Field label="Registration expiry"><DateInput value={form.registrationExpiry} onChange={setField("registrationExpiry")} /></Field>
        </div>

        <Field label="Notes"><TextInput value={form.notes} onChange={setField("notes")} /></Field>
      </div>
    </Modal>
  );
}
