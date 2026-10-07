import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const words = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? [];

const shingles = (w: string[], n = 5) => {
  const s = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(" "));
  return s;
};

const MARKERS = ["alem disso", "portanto", "em suma", "em conclusao", "e importante ressaltar",
  "vale destacar", "por outro lado", "nesse sentido", "diante disso", "ademais"];

// Heurística simples: frases muito uniformes + excesso de conectivos "de manual".
// É um INDÍCIO, não uma prova. Gera falsos positivos (ex.: textos bem revisados).
function aiIndicator(text: string) {
  const w = words(text);
  if (w.length < 120) return { score: null, note: "Texto curto demais para análise.", words: w.length };
  const sents = text.split(/[.!?]+\s/).map((s) => words(s).length).filter((n) => n > 2);
  const mean = sents.reduce((a, b) => a + b, 0) / Math.max(1, sents.length);
  const sd = Math.sqrt(sents.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, sents.length));
  const cv = sd / (mean || 1);
  const norm = " " + w.join(" ") + " ";
  const markers = MARKERS.reduce((n, m) => n + norm.split(" " + m + " ").length - 1, 0);
  const uniform = Math.max(0, Math.min(1, (0.6 - cv) / 0.4));
  const conn = Math.min(1, markers / (w.length / 100) / 2);
  return { score: Math.round((uniform * 0.6 + conn * 0.4) * 100), cv: +cv.toFixed(2), markers, words: w.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { assignment_id } = await req.json();
    const { data: ok } = await asUser.rpc("owns_assignment", { a: assignment_id });
    if (ok !== true) return json({ error: "Sem permissão." }, 403);

    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs, error } = await db
      .from("submissions").select("id,student_id,content").eq("assignment_id", assignment_id);
    if (error) throw error;

    const items = (subs ?? []).map((s) => ({ s, set: shingles(words(s.content)) }));
    for (const a of items) {
      let best = 0, who: string | null = null;
      for (const b of items) {
        if (a === b || !a.set.size) continue;
        let inter = 0;
        for (const x of a.set) if (b.set.has(x)) inter++;
        const c = inter / a.set.size;
        if (c > best) { best = c; who = b.s.student_id; }
      }
      const ai = aiIndicator(a.s.content);
      await db.from("submissions").update({
        similarity: Math.round(best * 100), similar_to: best > 0 ? who : null,
        ai_indicator: ai.score, analysis: ai,
      }).eq("id", a.s.id);
    }
    return json({ analyzed: items.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
