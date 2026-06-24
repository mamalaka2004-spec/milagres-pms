/**
 * Asaas payment gateway client (thin, typed wrapper around the v3 REST API).
 *
 * Activates only when ASAAS_API_KEY is set — otherwise `isConfigured()` is false and
 * the app keeps working with manual payments. Configure:
 *   ASAAS_API_KEY   = your access token
 *   ASAAS_BASE_URL  = https://api.asaas.com/v3 (prod) | https://sandbox.asaas.com/api/v3 (default)
 * Docs: https://docs.asaas.com/
 */

const DEFAULT_BASE = "https://sandbox.asaas.com/api/v3";

export function isConfigured(): boolean {
  return !!process.env.ASAAS_API_KEY;
}

function cfg() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_NOT_CONFIGURED");
  const baseUrl = (process.env.ASAAS_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { apiKey, baseUrl } = cfg();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (raw as { errors?: { description?: string }[] })?.errors?.[0]?.description || `HTTP ${res.status}`;
    throw new Error(`Asaas: ${msg}`);
  }
  return raw as T;
}

export type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string | null;
}

export interface AsaasPayment {
  id: string;
  status: string; // PENDING | RECEIVED | CONFIRMED | OVERDUE | REFUNDED | ...
  value: number;
  billingType: AsaasBillingType;
  dueDate: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  externalReference?: string | null;
}

export interface AsaasPixQr {
  encodedImage?: string; // base64 PNG (no data: prefix)
  payload?: string; // copia-e-cola
}

/** Find-or-create a customer (payer). cpfCnpj is recommended by Asaas but optional. */
export async function createCustomer(input: {
  name: string;
  email?: string | null;
  mobilePhone?: string | null;
  cpfCnpj?: string | null;
  externalReference?: string | null;
}): Promise<AsaasCustomer> {
  return call<AsaasCustomer>("POST", "/customers", {
    name: input.name,
    email: input.email || undefined,
    mobilePhone: input.mobilePhone || undefined,
    cpfCnpj: input.cpfCnpj || undefined,
    externalReference: input.externalReference || undefined,
  });
}

/** Create a charge (cobrança). */
export async function createPayment(input: {
  customer: string; // Asaas customer id
  billingType: AsaasBillingType;
  value: number; // BRL (reais, not cents)
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string; // our reservation id
}): Promise<AsaasPayment> {
  return call<AsaasPayment>("POST", "/payments", input);
}

export async function getPayment(id: string): Promise<AsaasPayment> {
  return call<AsaasPayment>("GET", `/payments/${id}`);
}

/** PIX QR code for a charge (only meaningful when billingType=PIX). */
export async function getPixQrCode(paymentId: string): Promise<AsaasPixQr> {
  return call<AsaasPixQr>("GET", `/payments/${paymentId}/pixQrCode`);
}

/** Map an Asaas payment status to our internal payments.status. */
export function mapStatus(asaasStatus: string): "pending" | "completed" | "failed" | "refunded" {
  switch (asaasStatus) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "completed";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "refunded";
    case "OVERDUE":
    case "DELETED":
    case "FAILED":
      return "failed";
    default:
      return "pending";
  }
}
