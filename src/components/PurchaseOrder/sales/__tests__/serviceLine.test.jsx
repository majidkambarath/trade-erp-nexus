import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

import SaleInvoiceView from '../InvoiceView.jsx';
import { invoiceLines } from '../../shared/invoiceModel';

// A service line (installation, consulting) on a printed invoice: it prints as a line like any other - code, description, quantity,
// price, VAT, total - with nothing about stock, a batch or a quantity on hand.
vi.mock('../../shared/useCompanyProfile', () => ({ useCompanyProfile: vi.fn(() => ({ companyName: '', vatNumber: '' })) }));
vi.mock('../../../../lib/sendDocumentsApi', () => ({
  sendSettings: { get: vi.fn(async () => ({ enabled: true, shareEnabled: true, attachPdf: true, shareLinkDays: 30, defaultNote: '' })) },
  documentSends: { send: vi.fn(), handoff: vi.fn(), history: vi.fn(), retry: vi.fn(), withdraw: vi.fn() },
}));

const service = { itemCode: 'SRV1', itemType: 'service', description: 'Installation and commissioning', qty: 2, rate: 800, vatAmount: 40, vatPercent: 5, stockDetails: { itemType: 'service', currentStock: null, unit: 'JOB' } };
const goods = { itemCode: 'ITM1', itemType: 'goods', description: 'Basmati 5kg', qty: 3, rate: 300, vatAmount: 15, vatPercent: 5, stockDetails: { itemType: 'goods', currentStock: 12, unit: 'BAG' } };

describe('invoiceLines', () => {
  it('turns a service line into the same printed row as goods: no stock field reaches the sheet', () => {
    const [row] = invoiceLines([service]);
    expect(Object.keys(row).sort()).toEqual(['code', 'description', 'no', 'qty', 'total', 'unitPrice', 'value', 'vat', 'vatPercent'].sort());
    expect(row).toMatchObject({ no: 1, code: 'SRV1', description: 'Installation and commissioning', qty: 2, unitPrice: 400, value: 800, vat: 40, vatPercent: 5, total: 840 });
  });
});

describe('the sales invoice with a service on it', () => {
  it('prints the service line beside the goods, with nothing about stock or a missing quantity', () => {
    const { container } = render(
      <MemoryRouter>
        <SaleInvoiceView
          selectedSO={null}
          createdSO={{ transactionNo: 'SO-77', status: 'APPROVED', date: '2026-10-10T00:00:00.000Z', customerId: 'c1', items: [goods, service] }}
          customers={[{ _id: 'c1', customerId: 'C1', customerName: 'Acme Corp', billingAddress: 'Dubai', phone: '1', email: 'a@b.com', trnNumber: 'TRN', paymentTerms: '30 Days' }]}
          setActiveView={vi.fn()} setSelectedSO={vi.fn()} setCreatedSO={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getAllByText('Installation and commissioning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Basmati 5kg').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SRV1').length).toBeGreaterThan(0);
    const text = container.textContent;
    for (const bad of ['NaN', 'undefined', 'null', 'Infinity', 'on hand', 'Batch']) expect(text).not.toContain(bad);
  });
});
