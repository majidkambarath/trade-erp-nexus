// One business term, one word, in every language. The guides' translations are checked against this table
// (src/guides/__tests__/exactness.test.js): when an English line uses a term, the translation must use THIS
// rendering of it, so "invoice" can never become "bill" on one card and "receipt" on the next.
//
// Style (owner's decision, 15 Nov 2026): Hindi and Malayalam use the English business word written in their own
// script (इनवॉइस, ഇൻവോയ്സ്) - it matches the English screen and how office staff actually speak. Arabic uses
// standard business Arabic. Abbreviations (VAT, TRN) stay in Latin letters in every language.
//
// An entry: { en: [English forms], ar / hi / ml: [accepted forms] }.
// The accepted forms are STEMS where the language inflects the word: Malayalam joins its endings to the noun
// (ഇൻവോയ്സ്, ഇൻവോയ്സിൽ, ഇൻവോയ്സുകൾ all contain "ഇൻവോയ്സ"), Arabic adds the article and suffixes (فاتورة,
// الفاتورة, فواتير). A translation passes when it contains ANY accepted form.
// Longer terms are matched first ("sales order" before "order", "balance sheet" before "balance"), and the
// on-screen names in [[...]] and examples in {{...}} are taken out before matching: they are never translated.

export const GLOSSARY = [
  { en: ["chart of accounts"], ar: ["دليل الحسابات"], hi: ["चार्ट ऑफ़ अकाउंट्स"], ml: ["ചാർട്ട് ഓഫ് അക്കൗണ്ട്സ"] },
  { en: ["post-dated cheque", "post-dated cheques"], ar: ["شيك مؤجل", "شيكات مؤجلة", "الشيك المؤجل", "الشيكات المؤجلة"], hi: ["पोस्ट-डेटेड चेक"], ml: ["പോസ്റ്റ്-ഡേറ്റഡ് ചെക്ക", "പോസ്റ്റ്-ഡേറ്റഡ് ചെക്കു"] },
  { en: ["profit and loss"], ar: ["الأرباح والخسائر"], hi: ["प्रॉफ़िट एंड लॉस"], ml: ["പ്രോഫിറ്റ് ആൻഡ് ലോസ"] },
  { en: ["balance sheet"], ar: ["الميزانية العمومية"], hi: ["बैलेंस शीट"], ml: ["ബാലൻസ് ഷീറ്റ"] },
  { en: ["opening balance", "opening balances"], ar: ["رصيد افتتاحي", "الرصيد الافتتاحي", "أرصدة افتتاحية", "الأرصدة الافتتاحية"], hi: ["ओपनिंग बैलेंस"], ml: ["ഓപ്പണിംഗ് ബാലൻസ"] },
  { en: ["purchase order", "purchase orders"], ar: ["أمر شراء", "أمر الشراء", "أوامر شراء", "أوامر الشراء"], hi: ["परचेज़ ऑर्डर"], ml: ["പർച്ചേസ് ഓർഡ"] },
  { en: ["sales order", "sales orders"], ar: ["أمر بيع", "أمر البيع", "أوامر بيع", "أوامر البيع"], hi: ["सेल्स ऑर्डर"], ml: ["സെയിൽസ് ഓർഡ"] },
  { en: ["delivery note", "delivery notes"], ar: ["إشعار تسليم", "إشعار التسليم", "إشعارات تسليم", "إشعارات التسليم"], hi: ["डिलीवरी नोट"], ml: ["ഡെലിവറി നോട്ട"] },
  { en: ["goods received", "goods receipt", "goods receipts"], ar: ["استلام البضاعة", "استلام بضاعة"], hi: ["गुड्स रिसीव्ड"], ml: ["ഗുഡ്സ് റിസീവ്ഡ"] },
  { en: ["sales return", "sales returns"], ar: ["مرتجع مبيعات", "مرتجع المبيعات", "مرتجعات المبيعات"], hi: ["सेल्स रिटर्न"], ml: ["സെയിൽസ് റിട്ടേൺ", "സെയിൽസ് റിട്ടേണ"] },
  { en: ["purchase return", "purchase returns"], ar: ["مرتجع مشتريات", "مرتجع المشتريات", "مرتجعات المشتريات"], hi: ["परचेज़ रिटर्न"], ml: ["പർച്ചേസ് റിട്ടേൺ", "പർച്ചേസ് റിട്ടേണ"] },
  { en: ["vat return", "vat returns"], ar: ["إقرار ضريبة القيمة المضافة", "الإقرار الضريبي"], hi: ["VAT रिटर्न"], ml: ["VAT റിട്ടേൺ", "VAT റിട്ടേണ"] },
  { en: ["credit note", "credit notes"], ar: ["إشعار دائن", "الإشعار الدائن", "إشعارات دائنة"], hi: ["क्रेडिट नोट"], ml: ["ക്രെഡിറ്റ് നോട്ട"] },
  { en: ["debit note", "debit notes"], ar: ["إشعار مدين", "الإشعار المدين", "إشعارات مدينة"], hi: ["डेबिट नोट"], ml: ["ഡെബിറ്റ് നോട്ട"] },
  { en: ["payment terms"], ar: ["شروط الدفع"], hi: ["पेमेंट टर्म्स"], ml: ["പേയ്മെന്റ് ടേംസ"] },
  { en: ["credit limit", "credit limits"], ar: ["حد الائتمان", "حدود الائتمان"], hi: ["क्रेडिट लिमिट"], ml: ["ക്രെഡിറ്റ് ലിമിറ്റ"] },
  { en: ["reorder level"], ar: ["حد إعادة الطلب"], hi: ["रीऑर्डर लेवल"], ml: ["റീഓർഡർ ലെവൽ", "റീഓർഡർ ലെവല"] },
  { en: ["fiscal year", "fiscal years"], ar: ["السنة المالية", "سنة مالية", "السنوات المالية"], hi: ["फ़िस्कल ईयर"], ml: ["ഫിസ്കൽ ഇയർ", "ഫിസ്കൽ ഇയറ"] },
  { en: ["bank reconciliation"], ar: ["التسوية البنكية", "تسوية البنك"], hi: ["बैंक रिकंसिलिएशन"], ml: ["ബാങ്ക് റീകൺസിലിയേഷ"] },
  { en: ["account statement", "statement"], ar: ["كشف حساب", "كشف الحساب"], hi: ["स्टेटमेंट"], ml: ["സ്റ്റേറ്റ്മെന്റ"] },

  { en: ["quotation", "quotations"], ar: ["عرض سعر", "عرض السعر", "عروض أسعار", "عروض الأسعار"], hi: ["कोटेशन"], ml: ["ക്വട്ടേഷ"] },
  { en: ["invoice", "invoices"], ar: ["فاتورة", "فواتير", "الفاتورة", "الفواتير", "فاتورت"], hi: ["इनवॉइस"], ml: ["ഇൻവോയ്സ"] },
  { en: ["customer", "customers"], ar: ["عميل", "عملاء"], hi: ["कस्टमर"], ml: ["കസ്റ്റമ"] },
  { en: ["vendor", "vendors", "supplier", "suppliers"], ar: ["مورد"], hi: ["वेंडर"], ml: ["വെണ്ട"] },
  { en: ["stock item", "stock items", "item", "items"], ar: ["صنف", "أصناف"], hi: ["आइटम"], ml: ["ഐറ്റ"] },
  { en: ["stock"], ar: ["مخزون", "المخزون"], hi: ["स्टॉक"], ml: ["സ്റ്റോക്ക", "സ്റ്റോക്കു"] },
  { en: ["receipt", "receipts"], ar: ["سند قبض", "سندات قبض", "سند القبض"], hi: ["रिसीप्ट"], ml: ["റസീപ്റ്റ"] },
  { en: ["payment", "payments"], ar: ["دفع", "دفعة", "سند صرف"], hi: ["पेमेंट"], ml: ["പേയ്മെന്റ"] },
  { en: ["voucher", "vouchers"], ar: ["سند", "سندات"], hi: ["वाउचर"], ml: ["വൗച്ചർ", "വൗച്ചറ"] },
  { en: ["expense", "expenses"], ar: ["مصروف", "مصروفات", "مصاريف"], hi: ["एक्सपेंस"], ml: ["എക്സ്പെൻസ"] },
  { en: ["journal"], ar: ["قيد يومية", "قيد اليومية", "قيود اليومية"], hi: ["जर्नल"], ml: ["ജേണൽ", "ജേണല"] },
  { en: ["contra"], ar: ["سند تحويل"], hi: ["कॉन्ट्रा"], ml: ["കോൺട്രാ"] },
  { en: ["cheque", "cheques"], ar: ["شيك", "شيكات"], hi: ["चेक"], ml: ["ചെക്ക", "ചെക്കു"] },
  { en: ["ledger"], ar: ["دفتر الأستاذ"], hi: ["लेजर"], ml: ["ലെഡ്ജർ", "ലെഡ്ജറ"] },
  { en: ["ageing"], ar: ["أعمار الذمم"], hi: ["एजिंग"], ml: ["ഏജിംഗ"] },
  { en: ["category", "categories"], ar: ["فئة", "فئات"], hi: ["कैटेगरी"], ml: ["കാറ്റഗറി"] },
  { en: ["unit", "units"], ar: ["وحدة", "وحدات"], hi: ["यूनिट"], ml: ["യൂണിറ്റ"] },
  { en: ["batch", "batches"], ar: ["دفعة إنتاج", "دفعات"], hi: ["बैच"], ml: ["ബാച്ച"] },
  { en: ["report", "reports"], ar: ["تقرير", "تقارير"], hi: ["रिपोर्ट"], ml: ["റിപ്പോർട്ട"] },
  { en: ["branch", "branches"], ar: ["فرع", "فروع"], hi: ["ब्रांच"], ml: ["ബ്രാഞ്ച"] },
  { en: ["role", "roles"], ar: ["دور", "أدوار"], hi: ["रोल"], ml: ["റോൾ", "റോള"] },
  { en: ["draft", "drafts"], ar: ["مسودة", "مسودات"], hi: ["ड्राफ्ट"], ml: ["ഡ്രാഫ്റ്റ"] },
  { en: ["approve", "approved", "approves", "approval"], ar: ["اعتماد", "اعتمد", "يعتمد", "معتمد", "اعتماده"], hi: ["अप्रूव"], ml: ["അപ്രൂവ"] },
  { en: ["account", "accounts"], ar: ["حساب", "حسابات"], hi: ["अकाउंट"], ml: ["അക്കൗണ്ട"] },
  { en: ["bank"], ar: ["بنك", "البنك", "بنكي", "البنكي"], hi: ["बैंक"], ml: ["ബാങ്ക"] },
  { en: ["vat"], ar: ["ضريبة القيمة المضافة"], hi: ["VAT"], ml: ["VAT"] },
  { en: ["trn"], ar: ["TRN"], hi: ["TRN"], ml: ["TRN"] },
];

// Strip what is never translated before a line is examined: on-screen names and example values.
export const stripFixed = (s) => String(s || "").replace(/\[\[[^\]]*\]\]/g, " ").replace(/\{\{[^}]*\}\}/g, " ");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Which glossary terms an English line uses, longest first, each span counted once
// ("sales order" is one term, not "sales order" + "order").
export function termsIn(english) {
  let rest = ` ${stripFixed(english).toLowerCase()} `;
  const found = [];
  const forms = GLOSSARY.flatMap((entry, i) => entry.en.map((f) => ({ f, i }))).sort((a, b) => b.f.length - a.f.length);
  for (const { f, i } of forms) {
    const re = new RegExp(`(^|[^a-z])${esc(f)}(?=[^a-z]|$)`, "g");
    if (re.test(rest)) {
      if (!found.includes(i)) found.push(i);
      rest = rest.replace(new RegExp(`(^|[^a-z])${esc(f)}(?=[^a-z]|$)`, "g"), "$1 ");
    }
  }
  return found.map((i) => GLOSSARY[i]);
}

// The terms an English line uses that its translation does NOT render the glossary's way.
export function missingTerms(english, translated, lang) {
  const text = stripFixed(translated);
  return termsIn(english).filter((entry) => !entry[lang].some((form) => text.includes(form))).map((e) => e.en[0]);
}

// The [[...]] and {{...}} a line carries, sorted, for comparing a translation with its English.
export const fixedParts = (s) => [...String(s || "").matchAll(/\[\[[^\]]*\]\]|\{\{[^}]*\}\}/g)].map((m) => m[0]).sort();
