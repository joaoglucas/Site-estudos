import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const message = body?.message || "";
    const activity = body?.activity || "";

    if (!message.trim()) {
      return new Response(
        JSON.stringify({
          error: "Nenhuma pergunta foi enviada.",
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY não está configurada no Supabase."
      );
    }

    const prompt = `
Você é o Tutor IA do StudyFlow.

Responda sempre em português do Brasil.

Sua função é ajudar estudantes a aprender, e não simplesmente entregar respostas.

Quando fizer sentido:
- explique passo a passo;
- use exemplos simples;
- destaque erros comuns;
- faça uma pequena pergunta de revisão no final.

ATIVIDADE:
${activity || "Nenhuma atividade informada."}

DÚVIDA DO ALUNO:
${message}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro retornado pelo Gemini:", data);

      throw new Error(
        data?.error?.message ||
          `Gemini retornou HTTP ${response.status}.`
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];

    const reply = parts
      .map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      throw new Error("O Gemini não retornou uma resposta.");
    }

    return new Response(
      JSON.stringify({
        reply: reply,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Erro na função gemini-chat:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido no Tutor IA.",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});