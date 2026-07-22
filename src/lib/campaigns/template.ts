// ===========================================================================
// Spintax + variáveis — espelho TS de supabase/functions/campaign-tick/
// campaign-utils.ts (manter em sincronia). Usado pelo passo IA e por previews.
// ===========================================================================

/** Expande spintax {a|b|c} recursivamente; {{var}} fica intacto. */
export function expandSpintax(input: string): string {
  if (!input) return input;
  const re = /\{([^{}]*\|[^{}]*)\}/;
  let out = input;
  let guard = 0;
  while (re.test(out) && guard < 100) {
    out = out.replace(re, (_m, body) => {
      const opts = String(body).split("|");
      return opts[Math.floor(Math.random() * opts.length)];
    });
    guard++;
  }
  return out;
}

/** Substitui {{var}} (case-insensitive) pelos valores de `vars`. */
export function substituteVars(template: string, vars: Record<string, unknown>): string {
  if (!template) return template;
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(vars ?? {})) {
    map.set(k.toLowerCase(), v == null ? "" : String(v));
  }
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key) => {
    const v = map.get(String(key).toLowerCase());
    return v == null ? "" : v;
  });
}
