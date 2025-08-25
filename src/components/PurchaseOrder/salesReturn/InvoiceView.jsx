import React from "react";
import { ArrowLeft, Download, Send } from "lucide-react";

const InvoiceView = ({ selectedSO, customers, calculateTotals, setActiveView }) => {
  if (!selectedSO) return null;

  const customer = customers.find((c) => c._id === selectedSO.customerId);
  let subtotal = 0;
  let totalTax = 0;
  selectedSO.items.forEach(item => {
    const value = item.qty * parseFloat(item.rate);
    const tax = value * (item.taxPercent / 100);
    subtotal += value;
    totalTax += tax;
  });
  const grandTotal = subtotal + totalTax;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setActiveView("list")}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to List</span>
          </button>
          <div className="flex space-x-3">
            <button className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              <Send className="w-4 h-4" />
              <span>Send to Customer</span>
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="bg-white shadow-lg border border-gray-200">
          {/* Company Header */}
          <div className="px-8 py-6 border-b">
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold text-gray-800 mb-1" dir="rtl">
                نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و
              </h1>
              <h2 className="text-xl font-bold text-teal-700 mb-2">
                NH FOODSTUFF TRADING LLC S.O.C.
              </h2>
            </div>
            
            {/* Purple header bar */}
            <div className="bg-purple-300 text-center py-2 -mx-8 mb-6">
              <h3 className="text-lg font-bold text-white">TAX INVOICE</h3>
            </div>

            <div className="flex justify-between items-start">
              <div className="text-sm space-y-1">
                <p>Dubai, UAE</p>
                <p>VAT Reg. No: 10503303</p>
                <p>Email: finance@nhfo.com</p>
                <p>Phone: +971 58 724 2111</p>
                <p>Web: www.nhfo.com</p>
              </div>
              
              {/* Logo and Company Info */}
              <div className="text-center">
                <img 
                  src="https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_uploads/NH%20foods_1755452579855.jpg" 
                  alt="NH Foods Logo" 
                  className="w-20 h-20 object-contain mb-2 mx-auto"
                />
                <p className="text-xs text-gray-600">Precision. Purity. Everyday</p>
              </div>
              
              <div className="text-right text-sm space-y-1">
                <p>Date: {new Date(selectedSO.date).toLocaleDateString("en-GB")}</p>
                <p>Invoice: 0110</p>
                <p>SO: {selectedSO.transactionNo}</p>
                <p>Quote Ref: {selectedSO.quoteRef || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Bill To Section */}
          <div className="px-8 py-4 bg-purple-100">
            <div className="flex justify-between">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Bill To:</h4>
                <div className="text-sm space-y-1">
                  <p className="font-semibold">{customer.customerName}</p>
                  <p>{customer.address}</p>
                  <p>Tel: {customer.phone}</p>
                </div>
              </div>
              <div className="text-right text-sm">
                <p>VAT Reg. No: {customer.vatNumber}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="px-8 py-6">
            <table className="w-full">
              <thead>
                <tr className="bg-purple-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Line</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">CODE</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Item Description</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Qty</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Unit price</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Value</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">VAT 5%</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedSO.items.map((item, index) => {
                  const value = item.qty * parseFloat(item.rate);
                  const vat = value * (item.taxPercent / 100);
                  const amount = value + vat;
                  return (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="px-3 py-3 text-sm text-center">{index + 1}</td>
                      <td className="px-3 py-3 text-sm">{item.itemId}</td>
                      <td className="px-3 py-3 text-sm">{item.description}</td>
                      <td className="px-3 py-3 text-sm text-center">{item.qty}</td>
                      <td className="px-3 py-3 text-sm text-center">{item.rate}</td>
                      <td className="px-3 py-3 text-sm text-center">{value.toFixed(2)}</td>
                      <td className="px-3 py-3 text-sm text-center">{vat.toFixed(2)}</td>
                      <td className="px-3 py-3 text-sm text-center font-semibold">{amount.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bank Details and Totals */}
          <div className="px-8 py-6 border-t">
            <div className="flex justify-between">
              <div className="w-1/2">
                <h4 className="font-semibold text-gray-800 mb-3">BANK DETAILS:-</h4>
                <div className="text-sm space-y-1">
                  <p><strong>BANK:</strong> NATIONAL BANK OF Abudhabi</p>
                  <p><strong>ACCOUNT NO:</strong> 087989283001</p>
                </div>
              </div>
              
              <div className="w-1/3">
                <table className="w-full">
                  <tr className="border border-gray-400">
                    <td className="px-3 py-2 text-sm font-semibold text-right">Sub Total</td>
                    <td className="px-3 py-2 text-sm text-center border-l border-gray-400">{subtotal.toFixed(2)}</td>
                  </tr>
                  <tr className="border-l border-r border-b border-gray-400">
                    <td className="px-3 py-2 text-sm font-semibold text-right">VAT (5%)</td>
                    <td className="px-3 py-2 text-sm text-center border-l border-gray-400">{totalTax.toFixed(2)}</td>
                  </tr>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="px-8 py-6 border-t">
            <div className="flex justify-between items-center mb-6">
              <div className="text-sm space-y-1">
                <p><strong>IBAN NO:</strong> AE410547283001</p>
                <p><strong>CURRENCY:</strong> AED</p>
                <p><strong>ACCOUNT NAME:</strong> NH FOODSTUFF TRADING LLC S.O.C</p>
              </div>
              
              <div className="border-2 border-gray-400 px-6 py-3">
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-bold">GRAND TOTAL</span>
                  <span className="text-xl font-bold">{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="text-sm">Received the above goods in good order and condition.</p>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-300">
              <div>
                <p className="text-sm">Received by: _______________________</p>
              </div>
              <div>
                <p className="text-sm">Prepared by: _______________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceView;