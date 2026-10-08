import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

import SaleInvoiceView from '../InvoiceView.jsx';
import { buildSalesDocument } from '../../shared/invoiceDocuments';

// The Settings profile: an empty company unless a test overrides it.
vi.mock('../../shared/useCompanyProfile', () => ({ useCompanyProfile: vi.fn(() => ({ companyName: '', vatNumber: '' })) }));

// The send service: the dialog reads the setup, and sending itself is not what is tested here.
vi.mock('../../../../lib/sendDocumentsApi', () => ({
  sendSettings: { get: vi.fn(async () => ({ enabled: true, shareEnabled: true, attachPdf: true, shareLinkDays: 30, defaultNote: '' })) },
  documentSends: { send: vi.fn(), handoff: vi.fn(), history: vi.fn(), retry: vi.fn(), withdraw: vi.fn() },
}));

// Mock the PDF libraries used on Download PDF
vi.mock('html2canvas', () => ({ default: vi.fn(async () => ({ width: 800, height: 1200, toDataURL: vi.fn(() => 'data:image/png;base64,FAKE') })) }));
const pdfInstances = [];
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => {
    const doc = { addImage: vi.fn(), addPage: vi.fn(), save: vi.fn(), output: vi.fn(() => new Blob(['%PDF-1.4'], { type: 'application/pdf' })), getNumberOfPages: vi.fn(() => 1) };
    pdfInstances.push(doc);
    return doc;
  }),
}));

beforeEach(() => {
  // jsdom has no 2D canvas; the PDF slicing only needs a context and a data URL
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,AA');
});

const baseProps = {
  selectedSO: null,
  createdSO: {
    transactionNo: 'SO-1234',
    status: 'DRAFT',
    date: '2025-01-10T00:00:00.000Z',
    customerId: 'c1',
    items: [
      { itemCode: 'ITM1', description: 'Item One', qty: 2, rate: 200, vatAmount: 10, vatPercent: 5 },
      { itemCode: 'ITM2', description: 'Item Two', qty: 3, rate: 300, vatAmount: 15, vatPercent: 5 },
    ],
  },
  customers: [
    { _id: 'c1', customerId: 'CUST-001', customerName: 'Acme Corp', billingAddress: 'Dubai', phone: '123', email: 'a@b.com', trnNumber: 'TRN', paymentTerms: '30 Days' },
  ],
  setActiveView: vi.fn(),
  setSelectedSO: vi.fn(),
  setCreatedSO: vi.fn(),
};

// The Link on the TRN warning needs a router, as it does in the app.
const renderView = (props) => render(<MemoryRouter><SaleInvoiceView {...props} /></MemoryRouter>);

describe('SaleInvoiceView', () => {
  afterEach(() => {
    vi.clearAllMocks();
    pdfInstances.length = 0;
  });

  it('shows a draft as a sales order, with the customer copy selected', () => {
    renderView(baseProps);

    expect(screen.getByText('Sales order', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Bill to')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Customer copy' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('computes and shows the totals and the VAT breakdown', () => {
    renderView(baseProps);

    // net 500, VAT 25, grand total 525; the breakdown repeats net and VAT for the 5% rate
    expect(screen.getAllByText('500.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('25.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('525.00').length).toBeGreaterThan(0);
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  it('shows the amount in words', () => {
    renderView(baseProps);
    expect(screen.getByText(/Five Hundred Twenty Five Dirhams Only/)).toBeInTheDocument();
  });

  it('never prints placeholder company details or the seller in the Bill to block', () => {
    renderView(baseProps);

    expect(screen.queryByText(/971 50 836/)).toBeNull();
    expect(screen.queryByText(/United Arab Emirates/)).toBeNull();
    expect(screen.queryByText(/Kerala/)).toBeNull();
    // the customer's own phone is shown, and the company email is not borrowed for it
    expect(screen.getByText(/Tel: 123/)).toBeInTheDocument();
    expect(screen.queryByText(/admin@test/)).toBeNull();
  });

  it('does not invent an invoice number for a sales order', () => {
    renderView(baseProps);
    expect(screen.queryByText('0000')).toBeNull();
    expect(screen.getByText('Order no.')).toBeInTheDocument();
    expect(screen.getAllByText('SO-1234').length).toBeGreaterThan(0);
  });

  it('shows the TRN warning on an invoice when the company has none', () => {
    renderView({ ...baseProps, createdSO: { ...baseProps.createdSO, status: 'APPROVED' } });
    expect(screen.getByText(/Your TRN is not set/)).toBeInTheDocument();
    expect(screen.getByText('Tax invoice', { selector: 'div' })).toBeInTheDocument();
  });

  it('a draft order is not a tax invoice, so it shows no Send at all (not a disabled one)', () => {
    renderView(baseProps);
    expect(screen.queryByRole('button', { name: /^send$/i })).toBeNull();
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('an approved invoice has a real Send that opens the dialog with the customer address ready', async () => {
    renderView({ ...baseProps, createdSO: { ...baseProps.createdSO, status: 'APPROVED', id: 'so1' } });
    const send = screen.getByRole('button', { name: /^send$/i });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Send tax invoice SO-1234');
    expect(await within(dialog).findByText('a@b.com')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /send email/i })).toBeInTheDocument();
  });

  it('an opening balance invoice is not sent from here', () => {
    renderView({ ...baseProps, createdSO: { ...baseProps.createdSO, status: 'APPROVED', id: 'so1', isOpening: true } });
    expect(screen.queryByRole('button', { name: /^send$/i })).toBeNull();
  });

  it('prints through a hidden frame, not a popup window', () => {
    renderView(baseProps);
    fireEvent.click(screen.getByRole('button', { name: /print/i }));
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('builds one PDF with the customer copy and the internal copy', async () => {
    const { jsPDF } = await import('jspdf');
    renderView(baseProps);

    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => expect(jsPDF).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pdfInstances[0].save).toHaveBeenCalledWith('Sales-order_SO-1234.pdf'));
    // the second copy starts a new page
    expect(pdfInstances[0].addPage).toHaveBeenCalled();
  });

  it('navigates back to list on Back to list', () => {
    renderView(baseProps);

    fireEvent.click(screen.getByRole('button', { name: /back to list/i }));

    expect(baseProps.setSelectedSO).toHaveBeenCalledWith(null);
    expect(baseProps.setCreatedSO).toHaveBeenCalledWith(null);
    expect(baseProps.setActiveView).toHaveBeenCalledWith('list');
  });
});

describe('buildSalesDocument', () => {
  const customer = { customerId: 'CUST-001', customerName: 'Acme', paymentTerms: '' };
  const company = { companyName: 'NH Foods', vatNumber: '100000000000003' };

  it('uses the tax invoice title and number only once the order is approved', () => {
    const draft = buildSalesDocument({ transactionNo: 'SO-1', status: 'DRAFT', items: [] }, customer, company, 'AED');
    const approved = buildSalesDocument({ transactionNo: 'SO-1', status: 'APPROVED', items: [] }, customer, company, 'AED');
    expect(draft.sheet.title).toBe('Sales order');
    expect(approved.sheet.title).toBe('Tax invoice');
    expect(approved.sheet.number).toEqual({ label: 'Invoice no.', value: 'SO-1' });
    expect(approved.fileName).toBe('Tax-invoice_SO-1');
  });

  it('shows the receipt block only on the order, not on the tax invoice', () => {
    expect(buildSalesDocument({ transactionNo: 'SO-1', status: 'DRAFT', items: [] }, customer, company, 'AED').sheet.receipt).toBe(true);
    expect(buildSalesDocument({ transactionNo: 'SO-1', status: 'APPROVED', items: [] }, customer, company, 'AED').sheet.receipt).toBe(false);
  });

  it('prints a zero-rated line as 0%', () => {
    const doc = buildSalesDocument(
      { transactionNo: 'SO-1', status: 'DRAFT', items: [{ qty: 1, rate: 100, vatAmount: 0, vatPercent: 0 }] },
      customer,
      company,
      'AED'
    );
    expect(doc.sheet.lines[0].vatPercent).toBe(0);
    expect(doc.sheet.breakdown).toEqual([{ rate: 0, taxable: 100, vat: 0 }]);
  });

  it('flags a missing TRN only on an invoice', () => {
    expect(buildSalesDocument({ transactionNo: 'SO-1', status: 'APPROVED', items: [] }, customer, { vatNumber: '' }, 'AED').missingTrn).toBe(true);
    expect(buildSalesDocument({ transactionNo: 'SO-1', status: 'DRAFT', items: [] }, customer, { vatNumber: '' }, 'AED').missingTrn).toBe(false);
    // and the other way round: a company that HAS a TRN is not told it is missing (this flag once looked for a field
    // the company object does not have, so every invoice carried the warning)
    expect(buildSalesDocument({ transactionNo: 'SO-1', status: 'APPROVED', items: [] }, customer, { vatNumber: '100123456700003' }, 'AED').missingTrn).toBe(false);
  });
});
