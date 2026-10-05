import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Boxes,
  Calculator,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Package,
  Receipt,
  FileCode2,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { cn } from "../../lib/utils";
import { getBrand } from "../../config/brands";
import BrandMark from "../shell/BrandMark";

const REMEMBER_KEY = "erp-remember-email";
const APP_NAME = getBrand().shortName;

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean(),
});

// Session tokens always live in sessionStorage: the shared axios client and the invoice
// pages read from there. "Remember me" only keeps the email address.
const storeSession = (tokens, adminId) => {
  sessionStorage.setItem("accessToken", tokens.accessToken);
  sessionStorage.setItem("refreshToken", tokens.refreshToken);
  if (adminId) sessionStorage.setItem("adminId", adminId);
};

const readRememberedEmail = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) || "";
  } catch {
    return "";
  }
};

const writeRememberedEmail = (email, remember) => {
  try {
    if (remember) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // storage unavailable (private mode) - non-fatal
  }
};

const FEATURES = [
  { icon: Package, title: "Orders & returns", text: "Purchase and sales orders with approvals and invoices." },
  { icon: Boxes, title: "Inventory & stock", text: "Live stock levels, movements and reorder alerts." },
  { icon: Receipt, title: "Vouchers & ledgers", text: "Receipts, payments and journals with party statements." },
  { icon: Calculator, title: "VAT reporting", text: "Period VAT reports at the UAE standard 5% rate." },
  {
    icon: FileCode2,
    title: "UAE e-invoicing",
    text: "Peppol and PINT AE support, ahead of the 2027 mandate.",
    soon: true,
  },
];

const Field = ({ id, label, error, icon, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-semibold text-foreground">
      {label}
    </label>
    <div className="relative">
      {React.createElement(icon, {
        "aria-hidden": "true",
        className:
          "pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground",
      })}
      {children}
    </div>
    {error && (
      <p id={`${id}-error`} className="text-sm text-destructive">
        {error}
      </p>
    )}
  </div>
);

const inputClass = (invalid) =>
  cn(
    "h-12 w-full rounded-xl border bg-card ps-11 pe-4 text-[15px] text-foreground",
    "placeholder:text-muted-foreground transition-colors outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
    invalid ? "border-destructive" : "border-input"
  );

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const rememberedEmail = readRememberedEmail();

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: rememberedEmail,
      password: "",
      rememberMe: Boolean(rememberedEmail),
    },
  });

  useEffect(() => {
    setFocus(rememberedEmail ? "password" : "email");
    // Focus once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values) => {
    setServerError("");
    try {
      const { data } = await axiosInstance.post("/login", {
        email: values.email,
        password: values.password,
      });

      if (!data?.success) {
        setServerError(data?.message || "Sign-in failed. Please try again.");
        return;
      }

      const { admin, tokens } = data.data;
      storeSession(tokens, admin?._id);
      writeRememberedEmail(values.email, values.rememberMe);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (error.response) {
        setServerError(
          error.response.data?.message ||
            (error.response.status === 401
              ? "Incorrect email or password."
              : "Sign-in failed. Please try again.")
        );
      } else if (error.request) {
        setServerError("Can't reach the server. Check your connection and try again.");
      } else {
        setServerError("Sign-in failed. Please try again.");
      }
    }
  };

  return (
    <div className="grid min-h-dvh bg-background font-sans text-foreground lg:grid-cols-2">
      {/* Brand panel: desktop only */}
      <aside className="relative hidden overflow-hidden bg-brand-soft lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-24 -top-24 h-96 w-96 rounded-full bg-brand opacity-[0.14]"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-11 w-11" />
          <span className="text-lg font-extrabold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="relative max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/70">
            Trade ERP
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight">
            Run purchasing, sales and stock from one place.
          </h1>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon, title, text, soon }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card shadow-card">
                  {React.createElement(icon, { className: "h-5 w-5", "aria-hidden": "true" })}
                </span>
                <span>
                  <span className="flex items-center gap-2 font-bold">
                    {title}
                    {soon && (
                      <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        Coming soon
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-foreground/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-foreground/70">
          Accounts are created by your administrator.
        </p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Brand header: mobile only */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-10 w-10" />
            <span className="text-lg font-extrabold tracking-tight">{APP_NAME}</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight">Sign in</h2>
          <p className="mt-2 text-muted-foreground">Use your ERP account to continue.</p>

          {serverError && (
            <div
              id="login-error"
              role="alert"
              className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            <Field id="email" label="Email address" icon={Mail} error={errors.email?.message}>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={inputClass(Boolean(errors.email))}
                {...register("email")}
              />
            </Field>

            <Field id="password" label="Password" icon={Lock} error={errors.password?.message}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={cn(inputClass(Boolean(errors.password)), "pe-12")}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute end-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? (
                  <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
                ) : (
                  <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
                )}
              </button>
            </Field>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-foreground"
                {...register("rememberMe")}
              />
              Remember my email on this device
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Forgot your password? Ask your administrator to reset it.
          </p>
        </div>
      </main>
    </div>
  );
}
