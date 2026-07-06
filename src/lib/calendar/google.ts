/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Google Calendar bidirecional por anúncio — SCAFFOLD (Fase 9, #25)
// ===========================================================================
// BLOQUEADO EM CREDENCIAIS. O fluxo OAuth real exige client_id / client_secret
// + redirect URI verificado no Google Cloud Console, que NÃO temos nesta fase.
// Este arquivo é o CONTRATO da integração: leitura das conexões (já funciona,
// lê a tabela da migration 031) + stubs do OAuth/sync que lançam enquanto não
// houver credenciais. NENHUM segredo é hardcoded.
//
// Wiring real que falta (TODO):
//   1. Registrar app no Google Cloud, obter client_id/secret e verificar o
//      redirect URI (ex.: https://app.milagres.../api/settings/google-calendar/callback).
//   2. Definir GOOGLE_OAUTH_CLIENT_ID / _SECRET / _REDIRECT_URI no ambiente.
//   3. Implementar getAuthUrl → exchangeCodeForTokens → armazenar tokens
//      (cifrados/Vault) em google_calendar_connections.
//   4. Implementar syncConnection: import (Google → reservas/bloqueios) e
//      export (reservas → Google), respeitando `direction`, gravando sync_token
//      e registrando em google_calendar_sync_log.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";

export type GcalDirection = "import" | "export" | "both";
export type GcalStatus = "disconnected" | "pending_auth" | "connected" | "error";

export interface GoogleCalendarConnection {
  id: string;
  company_id: string;
  property_id: string | null;
  google_calendar_id: string | null;
  google_account_email: string | null;
  direction: GcalDirection;
  status: GcalStatus;
  token_expires_at: string | null;
  sync_token: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/**
 * true somente quando TODAS as credenciais OAuth do Google estão presentes no
 * ambiente. Enquanto false, a UI mostra o estado "requer credenciais Google
 * OAuth" e as ações de conexão/sync ficam desabilitadas.
 */
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

/** Erro sentinela para respostas 501 (feature ainda não configurada). */
export class GoogleCalendarNotConfiguredError extends Error {
  constructor(message = "Google Calendar OAuth não está configurado") {
    super(message);
    this.name = "GoogleCalendarNotConfiguredError";
  }
}

// ─── Leitura (funciona hoje: só lê a tabela) ────────────────────────────────

export async function listConnections(
  companyId: string
): Promise<GoogleCalendarConnection[]> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("google_calendar_connections") as any)
    .select(
      "id, company_id, property_id, google_calendar_id, google_account_email, direction, status, token_expires_at, sync_token, last_synced_at, last_error, created_by, created_at, updated_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as GoogleCalendarConnection[]) || [];
}

// ─── OAuth / sync (STUBS — bloqueados até haver credenciais) ─────────────────

/**
 * Monta a URL de consentimento OAuth do Google. TODO: implementar com o
 * client_id + redirect_uri + scopes + state (id da conexão/anúncio).
 */
export function getAuthUrl(_params: {
  connectionId: string;
  propertyId: string | null;
}): string {
  throw new GoogleCalendarNotConfiguredError();
}

/** Troca o `code` do callback por tokens. TODO: chamada real ao token endpoint. */
export async function exchangeCodeForTokens(_code: string): Promise<never> {
  throw new GoogleCalendarNotConfiguredError();
}

/**
 * Executa uma sincronização (import/export) de uma conexão. TODO: implementar
 * o pull incremental (syncToken) e o push de reservas para o Google.
 */
export async function syncConnection(_connectionId: string): Promise<never> {
  throw new GoogleCalendarNotConfiguredError();
}
