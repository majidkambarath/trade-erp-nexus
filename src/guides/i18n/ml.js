// Malayalam wording of the guides: the same keys as en.js (guides.test.js fails when one is missing).
// The screens themselves are in English, so a button is named as it is written on the screen (Add Customer),
// and only the explanation is Malayalam. Drafted with AI; `reviewed: false` makes the card say so until a
// native speaker has read it and this is set to true.

import sell from "./sell/ml";
import buy from "./buy/ml";
import stock from "./stock/ml";
import money from "./money/ml";
import accounts from "./accounts/ml";
import reports from "./reports/ml";

export default {
  ...sell,
  ...buy,
  ...stock,
  ...money,
  ...accounts,
  ...reports,
  reviewed: false,

  ui: {
    guideMe: "വഴികാട്ടി",
    stepOf: (i, n) => `ഘട്ടം ${i} / ${n}`,
    next: "അടുത്തത്",
    back: "പിന്നിലേക്ക്",
    skip: "ഈ ഘട്ടം ഒഴിവാക്കുക",
    stop: "ഗൈഡ് നിർത്തുക",
    optional: "ഐച്ഛികം",
    lost: "ഇത് നിങ്ങളുടെ സ്ക്രീനിൽ കണ്ടെത്താനാകുന്നില്ല. ഇത് മറ്റൊരു ടാബിലായിരിക്കാം, അല്ലെങ്കിൽ നിങ്ങൾക്ക് ലഭ്യമല്ലായിരിക്കാം.",
    inReview: "പരിഭാഷ പരിശോധനയിൽ",
    language: "ഭാഷ",
    menuTitle: "ഈ സ്ക്രീനിനുള്ള ഗൈഡുകൾ",
    allGuides: "എല്ലാ ഗൈഡുകളും",
    noneHere: "ഈ സ്ക്രീനിന് ഇതുവരെ ഗൈഡ് ഇല്ല.",
    finished: "പൂർത്തിയായി",
    start: "ഗൈഡ് തുടങ്ങുക",
    minutes: (n) => `${n} മിനിറ്റ്`,
    here: "ഈ സ്ക്രീൻ",
  },

  "flow.add-customer": { title: "കസ്റ്റമറെ ചേർക്കുക", text: "നിങ്ങൾ വിൽക്കുന്ന വ്യക്തിയോ കമ്പനിയോ. ഓരോ വിൽപ്പന രേഖയിലും നിങ്ങൾ ഇവരെ തിരഞ്ഞെടുക്കും." },
  "add-customer.open": { title: "കസ്റ്റമേഴ്സ്", text: "കസ്റ്റമേഴ്സ് [[Sales]]-ന് കീഴിലാണ്. പേജ് ഞങ്ങൾ തുറന്നിട്ടുണ്ട്." },
  "add-customer.add": { title: "കസ്റ്റമറെ ചേർക്കുക", text: "[[Add Customer]] അമർത്തുക." },
  "add-customer.name": { title: "അവരുടെ പേര്", text: "ഇൻവോയ്സിൽ അച്ചടിക്കേണ്ട രീതിയിൽ കമ്പനിയുടെയോ വ്യക്തിയുടെയോ പേര് ടൈപ്പ് ചെയ്യുക, ഉദാഹരണത്തിന് {{Al Madina Fresh Supermarket LLC}}." },
  "add-customer.contact": { title: "നിങ്ങൾ ആരുമായി ഇടപെടുന്നു", text: "അവരുടെ കമ്പനിയിൽ നിങ്ങൾ സംസാരിക്കുന്ന വ്യക്തി." },
  "add-customer.phone": { title: "ഫോൺ", text: "അവരെ ബന്ധപ്പെടാവുന്ന ഒരു നമ്പർ. ഇത് പിന്നീടും നൽകാം." },
  "add-customer.address": { title: "ബില്ലിംഗ് വിലാസം", text: "ഇൻവോയ്സുകൾ അയയ്ക്കുന്ന വിലാസം. ഈ കസ്റ്റമർക്കുള്ള ഓരോ ഇൻവോയ്സിലും ഇത് അച്ചടിക്കും." },
  "add-customer.taxtab": { title: "നികുതി വിവരങ്ങൾ", text: "കസ്റ്റമർ നികുതിക്ക് രജിസ്റ്റർ ചെയ്തിട്ടുണ്ടെങ്കിൽ ഈ ടാബ് തുറക്കുക." },
  "add-customer.vatstatus": { title: "നികുതിക്ക് രജിസ്റ്റർ ചെയ്തിട്ടുണ്ടോ?", text: "കസ്റ്റമർക്ക് നികുതി രജിസ്ട്രേഷൻ നമ്പർ ഉണ്ടെങ്കിൽ [[Registered]] തിരഞ്ഞെടുക്കുക. [[Not registered]] ആണെങ്കിൽ നൽകാൻ നമ്പർ ഇല്ല." },
  "add-customer.trn": { title: "നികുതി രജിസ്ട്രേഷൻ നമ്പർ", text: "അവരുടെ TRN (ഇന്ത്യയിൽ GSTIN). ഇത് ഇൻവോയ്സിൽ അച്ചടിക്കും, VAT റിട്ടേണിനും ആവശ്യമാണ്." },
  "add-customer.credittab": { title: "ക്രെഡിറ്റും നിബന്ധനകളും", text: "പണം അടയ്ക്കാൻ അവർക്ക് എത്ര സമയമുണ്ടെന്ന് പറയാൻ ഈ ടാബ് തുറക്കുക." },
  "add-customer.terms": { title: "പേയ്മെന്റ് ടേംസ്", text: "ഉദാഹരണത്തിന് {{Net 30}}. ഒരു ഇൻവോയ്സ് എപ്പോൾ വൈകി എന്ന് റിപ്പോർട്ടുകൾ ഇതിൽ നിന്ന് അറിയുന്നു." },
  "add-customer.save": { title: "സേവ് ചെയ്യുക", text: "സേവ് ചെയ്യാൻ [[Add Customer]] അമർത്തുക. എന്തും പിന്നീട് മാറ്റാം." },
  "add-customer.done": { title: "കസ്റ്റമറെ ചേർത്തു", text: "ഇനി ഒരു ക്വട്ടേഷനിലോ ഇൻവോയ്സിലോ ഈ കസ്റ്റമറെ തിരഞ്ഞെടുക്കാം. അടുത്തത്: ഒരു വെണ്ടറെ ചേർക്കുക, അതായത് നിങ്ങൾ വാങ്ങുന്നവരെ." },

  "flow.add-vendor": { title: "വെണ്ടറെ ചേർക്കുക", text: "നിങ്ങൾ വാങ്ങുന്ന വ്യക്തിയോ കമ്പനിയോ. ഓരോ വാങ്ങലിലും ഇവരെ തിരഞ്ഞെടുക്കും." },
  "add-vendor.open": { title: "വെണ്ടർമാർ", text: "വെണ്ടർമാർ [[Purchase]]-ന് കീഴിലാണ്. പേജ് ഞങ്ങൾ തുറന്നിട്ടുണ്ട്." },
  "add-vendor.add": { title: "വെണ്ടറെ ചേർക്കുക", text: "[[Add Vendor]] അമർത്തുക." },
  "add-vendor.name": { title: "അവരുടെ പേര്", text: "വെണ്ടറുടെ കമ്പനിയുടെ പേര്, ഉദാഹരണത്തിന് {{Gulf Grain Importers LLC}}." },
  "add-vendor.contact": { title: "നിങ്ങൾ ആരുമായി ഇടപെടുന്നു", text: "വെണ്ടറുടെ അടുത്ത് നിങ്ങൾ ബന്ധപ്പെടേണ്ട വ്യക്തി." },
  "add-vendor.address": { title: "വിലാസം", text: "വെണ്ടറുടെ വിലാസം." },
  "add-vendor.taxtab": { title: "നികുതി വിവരങ്ങൾ", text: "വെണ്ടർ നികുതിക്ക് രജിസ്റ്റർ ചെയ്തിട്ടുണ്ടെങ്കിൽ ഈ ടാബ് തുറക്കുക." },
  "add-vendor.vatstatus": { title: "നികുതിക്ക് രജിസ്റ്റർ ചെയ്തിട്ടുണ്ടോ?", text: "വെണ്ടർക്ക് നികുതി രജിസ്ട്രേഷൻ നമ്പർ ഉണ്ടെങ്കിൽ [[Registered]] തിരഞ്ഞെടുക്കുക. [[Not registered]] ആണെങ്കിൽ നൽകാൻ നമ്പർ ഇല്ല." },
  "add-vendor.trn": { title: "നികുതി രജിസ്ട്രേഷൻ നമ്പർ", text: "അവരുടെ TRN. അവരുടെ ഇൻവോയ്സുകളിലെ VAT തിരികെ ക്ലെയിം ചെയ്യാൻ ഇത് വേണം." },
  "add-vendor.save": { title: "സേവ് ചെയ്യുക", text: "സേവ് ചെയ്യാൻ [[Add Vendor]] അമർത്തുക." },
  "add-vendor.done": { title: "വെണ്ടറെ ചേർത്തു", text: "ഇനി ഈ വെണ്ടറിൽ നിന്ന് വാങ്ങാം. അടുത്തത്: നിങ്ങൾ വ്യാപാരം ചെയ്യുന്ന സാധനങ്ങൾ, അതായത് സ്റ്റോക്ക് ഐറ്റങ്ങൾ ചേർക്കുക." },

  "flow.add-item": { title: "സ്റ്റോക്ക് ഐറ്റം ചേർക്കുക", text: "നിങ്ങൾ വാങ്ങുകയും വിൽക്കുകയും ചെയ്യുന്ന ഉൽപ്പന്നം. ആദ്യ വാങ്ങൽ മുതൽ അതിന്റെ സ്റ്റോക്കും ചെലവും ട്രാക്ക് ചെയ്യപ്പെടുന്നു." },
  "add-item.open": { title: "സ്റ്റോക്ക് ഐറ്റങ്ങൾ", text: "ഐറ്റങ്ങൾ [[Inventory]]-ക്ക് കീഴിലാണ്. പേജ് ഞങ്ങൾ തുറന്നിട്ടുണ്ട്." },
  "add-item.add": { title: "ഐറ്റം ചേർക്കുക", text: "[[Add Stock Item]] അമർത്തുക." },
  "add-item.name": { title: "ഐറ്റത്തിന്റെ പേര്", text: "രേഖകളിൽ നിങ്ങൾ ഉപയോഗിക്കുന്ന പേര്, ഉദാഹരണത്തിന് {{Basmati Rice 40kg Bag}}." },
  "add-item.category": { title: "കാറ്റഗറി", text: "സമാന ഐറ്റങ്ങളെ റിപ്പോർട്ടുകൾക്കായി ഒരുമിച്ചാക്കുന്നു. ഒരു കാറ്റഗറി തിരഞ്ഞെടുക്കുക, അല്ലെങ്കിൽ പുതിയത് ടൈപ്പ് ചെയ്ത് ചേർക്കുക." },
  "add-item.unit": { title: "യൂണിറ്റ്", text: "നിങ്ങൾ ഇത് എങ്ങനെ എണ്ണുന്നു: ബാഗ്, കാർട്ടൺ, പീസ്, കിലോഗ്രാം." },
  "add-item.cost": { title: "വാങ്ങൽ വില", text: "ഒരു യൂണിറ്റിന് സാധാരണ നിങ്ങൾക്ക് എത്ര ചെലവാകും. ആദ്യ വാങ്ങലിന് ശേഷം ശരാശരി ചെലവ് Zarvia തന്നെ കണക്കാക്കും." },
  "add-item.price": { title: "വിൽപ്പന വില", text: "ഒരു യൂണിറ്റിന് സാധാരണ നിങ്ങൾ ഈടാക്കുന്ന തുക. ഓരോ ഇൻവോയ്സിലും ഇത് മാറ്റാം." },
  "add-item.reorder": { title: "റീഓർഡർ ലെവൽ", text: "സ്റ്റോക്ക് ഈ എണ്ണത്തിലേക്ക് താഴുമ്പോൾ കൂടുതൽ വാങ്ങണമെന്ന് റീഓർഡർ റിപ്പോർട്ട് അറിയിക്കും." },
  "add-item.save": { title: "സേവ് ചെയ്യുക", text: "സേവ് ചെയ്യാൻ [[Add Item]] അമർത്തുക." },
  "add-item.done": { title: "ഐറ്റം ചേർത്തു", text: "ഇത് സ്റ്റോക്ക് ഇല്ലാതെയാണ് തുടങ്ങുന്നത്. ഒരു പർച്ചേസ് ഇൻവോയ്സ് അപ്രൂവ് ചെയ്യുമ്പോൾ സ്റ്റോക്ക് എത്തും." },
};
