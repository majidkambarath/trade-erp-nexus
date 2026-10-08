import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { Field, Spinner, TextInput, Textarea, useAsync } from "../accounting/kit";
import { ActionModal, Note } from "../salesDocs/parts";
import { useDocumentAction } from "../salesDocs/hooks";
import { documentSends, sendSettings } from "../../lib/sendDocumentsApi";
import {
  attachmentDecision, attachmentNote, defaultRecipients, defaultSubject, newIdempotencyKey, sendProblem, toWaNumber, validateSend,
} from "../../lib/sendForms";
import { cn } from "../../lib/utils";
import RecipientField from "./RecipientField";

// One dialog to send a document to a customer, by email or WhatsApp. It is handed a DESCRIPTOR, not a
// document, which is what lets every kind of document share it:
//
//   doc        { kind, id, number, title, companyName, party: { email, phone, contacts }, notice }
//   attachment { build() -> Promise<File>, label }       the customer copy, drawn by the browser
//
// The server's refusals are shown inside the dialog and nothing typed is lost; a double click is one
// send, because every press of the button carries a key the server recognises.

const CHANNELS = [
  { id: "email", label: "Email", Icon: Mail },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

export default function SendDialog({ doc, attachment, notify, onSent, onClose }) {
  const settings = useAsync(() => sendSettings.get(), []);
  const s = settings.data;
  const [channel, setChannel] = useState("email");
  const [to, setTo] = useState(() => defaultRecipients(doc.party));
  const [toText, setToText] = useState("");
  const [cc, setCc] = useState([]);
  const [ccText, setCcText] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(() => defaultSubject({ title: doc.title, number: doc.number, companyName: doc.companyName }));
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState(doc.party?.phone || "");
  const [attach, setAttach] = useState(true);
  const [errors, setErrors] = useState({});
  const action = useDocumentAction({ notify, reload: undefined });

  // The wording the company chose, once it has loaded and only if the person has not started writing.
  const noteTouched = useRef(false);
  useEffect(() => {
    if (s?.defaultNote && !noteTouched.current) setNote(s.defaultNote);
  }, [s?.defaultNote]);

  // The customer copy is drawn as soon as the dialog opens, so it can say how big it is, and is kept so
  // that sending again after a refusal does not draw it a second time.
  //
  // The page behind this dialog may re-render while the PDF is being drawn (a toast, a reload of the list), and
  // it hands over a NEW attachment object each time. The drawing therefore starts once, from the latest object
  // held in a ref, and only whether the dialog is still open decides if its result is kept: depending on the
  // object itself threw a finished PDF away and left the dialog "drawing" forever.
  const [file, setFile] = useState({ state: "idle", file: null, error: "" });
  const built = useRef(false);
  const attachmentRef = useRef(attachment);
  attachmentRef.current = attachment;
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => { open.current = false; };
  }, []);
  const wantsFile = Boolean(attachment) && s ? s.attachPdf : false;
  useEffect(() => {
    if (!wantsFile || built.current) return;
    built.current = true;
    setFile({ state: "building", file: null, error: "" });
    attachmentRef.current.build().then(
      (f) => open.current && setFile({ state: "ready", file: f, error: "" }),
      (e) => open.current && setFile({ state: "failed", file: null, error: e?.message || "The PDF could not be drawn." })
    );
  }, [wantsFile]);

  const decision = useMemo(() => (file.file ? attachmentDecision({ bytes: file.file.size, pages: file.file.pageCount }) : { allowed: true, reason: "" }), [file.file]);
  const sending = channel === "email" ? { ready: Boolean(s?.enabled) } : { ready: Boolean(s?.shareEnabled) };
  const keyRef = useRef(newIdempotencyKey());
  const waNumber = toWaNumber(phone);

  // `force` is a deliberate second send of something the server says was just sent: a new press, a new key.
  const submit = async (force = false) => {
    const check = validateSend({ channel, to: [...to, toText].join(","), cc: [...cc, ccText].join(","), phone });
    setErrors(check.errors);
    if (Object.keys(check.errors).length) return;
    // A second press after a refusal keeps its key (the server then knows it is the same press); only a
    // deliberate "send anyway" is a new send.
    if (force) keyRef.current = newIdempotencyKey();

    if (channel === "whatsapp") {
      const done = await action.run(
        () => documentSends.handoff({ docType: doc.kind, sourceId: doc.id, phone: phone.trim() || undefined, note: note.trim() || undefined }, keyRef.current),
        (r) => (r?.waUrl ? "WhatsApp is open with the message ready. Press send there." : "This was already handed over to WhatsApp."),
        { refresh: false }
      );
      if (done && done !== true) {
        if (done.waUrl) window.open(done.waUrl, "_blank", "noopener");
        onSent?.(done);
        onClose();
      }
      return;
    }

    const useFile = attach && wantsFile && decision.allowed && file.file;
    const done = await action.run(
      () => documentSends.send({ docType: doc.kind, sourceId: doc.id, to: check.to, cc: check.cc, subject: subject.trim(), note: note.trim(), includeShareLink: true, force: force ? "true" : undefined }, useFile ? file.file : null, keyRef.current),
      (r) => (r?.duplicate ? "This was already sent." : r?.send?.provider === "console" ? `${doc.title} ${doc.number} recorded, but NOT emailed: no email service is connected` : `${doc.title} ${doc.number} emailed to ${check.to[0]}${check.to.length > 1 ? ` and ${check.to.length - 1} more` : ""}`),
      { refresh: false }
    );
    if (done && done !== true) {
      onSent?.(done);
      onClose();
    }
  };

  const problem = action.problem;
  const duplicate = problem?.code === "DUPLICATE_SEND";
  const shown = problem ? sendProblem(problem) : null;

  const email = channel === "email";
  const confirmLabel = duplicate ? "Send anyway" : email ? "Send email" : "Open WhatsApp";
  const blocked = !s || !sending.ready || (email && wantsFile && file.state === "building");

  return (
    <ActionModal
      size="md" title={`Send ${doc.title.toLowerCase()} ${doc.number}`} confirmLabel={confirmLabel} busy={action.busy} disabled={blocked}
      problem={shown ? { message: shown.message } : null} onClose={onClose}
      onConfirm={() => submit(duplicate)}
      description={email ? "The customer gets an email with the document and a link to view it." : "WhatsApp opens with the message and the link already written. You press send there."}
    >
      {settings.loading && !s && <Spinner label="Loading" />}
      {settings.error && !s && <Note tone="danger">{settings.error.message}</Note>}

      {s && (
        <>
          <div className="inline-flex rounded-lg border border-input p-0.5 text-sm font-medium" role="group" aria-label="How to send">
            {CHANNELS.map((c) => {
              const Icon = c.Icon;
              return (
                <button
                  key={c.id} type="button" aria-pressed={channel === c.id} onClick={() => { setChannel(c.id); setErrors({}); }}
                  className={cn("inline-flex min-h-11 items-center gap-2 rounded-md px-4 lg:min-h-9", channel === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />{c.label}
                </button>
              );
            })}
          </div>

          {!sending.ready && (
            <Note tone="warning">
              {email ? "Email is not switched on yet. " : "Links are switched off, and WhatsApp carries the link. "}
              <Link to="/settings?tab=sending" className="font-semibold underline underline-offset-2">Set it up in Settings</Link>
              {email && s.shareEnabled ? ", or use WhatsApp, which needs no setup." : "."}
            </Note>
          )}
          {email && sending.ready && s.provider === "console" && (
            <Note tone="warning">
              Test mode: nothing will be emailed, the send is only recorded. Connect an email service to send for real.{" "}
              <Link to="/settings?tab=sending" className="font-semibold underline underline-offset-2">Open Settings</Link>
            </Note>
          )}
          {doc.notice && <Note>{doc.notice}</Note>}

          {email ? (
            <>
              <RecipientField label="To" emails={to} onChange={setTo} pending={toText} onPending={setToText} error={errors.to} placeholder="customer@example.com" autoFocus={!to.length}
                hint={to.length ? undefined : "This customer has no email saved. Type one; it is not saved on the customer."} />
              {showCc
                ? <RecipientField label="Cc" emails={cc} onChange={setCc} pending={ccText} onPending={setCcText} error={errors.cc} placeholder="copy to" />
                : <button type="button" onClick={() => setShowCc(true)} className="text-start text-sm font-medium text-foreground underline underline-offset-2">Add cc</button>}
              <Field label="Subject"><TextInput value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></Field>
              <Field label="Message" hint="Added under the greeting. Optional.">
                <Textarea rows={3} value={note} maxLength={1000} onChange={(e) => { noteTouched.current = true; setNote(e.target.value); }} />
              </Field>

              {wantsFile && (
                <div className="space-y-1.5">
                  <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
                    <input type="checkbox" className="h-5 w-5 rounded border-input" checked={attach && decision.allowed && file.state === "ready"} disabled={file.state !== "ready" || !decision.allowed} onChange={(e) => setAttach(e.target.checked)} />
                    Attach the PDF
                  </label>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {file.state === "building" && <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Drawing the PDF…</span>}
                    {file.state === "ready" && decision.allowed && attachmentNote({ label: attachment.label, pages: file.file.pageCount, bytes: file.file.size })}
                    {file.state === "ready" && !decision.allowed && decision.reason}
                    {file.state === "failed" && `The PDF could not be drawn (${file.error}). The email will carry the link instead.`}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                The email carries a link to this document. Anyone with the link can open it, and it stops working after {s.shareLinkDays} days. You can withdraw it from the send history.
              </p>
            </>
          ) : (
            <>
              <Field label="WhatsApp number" error={errors.phone} hint={waNumber ? `Opens WhatsApp for +${waNumber}.` : "With the country code, for example +971 50 111 2222. Leave it empty to choose the contact in WhatsApp."}>
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
              </Field>
              <Field label="Message" hint="Added to the message. Optional.">
                <Textarea rows={2} value={note} maxLength={300} onChange={(e) => { noteTouched.current = true; setNote(e.target.value); }} />
              </Field>
              <Note>
                WhatsApp opens with the message and a link to the document. You press send there. This system cannot tell whether it was sent, so the history says <strong>given on WhatsApp</strong>, nothing more. Anyone with the link can open it for {s.shareLinkDays} days.
              </Note>
            </>
          )}
        </>
      )}
    </ActionModal>
  );
}
