import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 既定は無料枠の広い Flash-Lite。混雑時や精度不足時は env で
// "gemini-2.5-flash" 等に切り替えられる。
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
function modelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}
const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const PROMPT = `この画像は日本株の株主優待券・案内・メール画面・PDFのいずれかです。
以下のスキーマに沿って情報を抽出し、JSONのみを返してください。
読み取れない項目は null にしてください。

- title: 優待の名称（例: "お食事券", "QUOカード", "100株優待"）
- company: 発行企業名（カタカナ・漢字どちらでも、株式会社等の法人格は省略可）
- expiresOn: 有効期限を YYYY-MM-DD 形式（例: "2026-12-31"）
- amountYen: 金額（円）。額面が読み取れる場合のみ整数で。読めなければ null
- quantity: 枚数。複数枚セットの場合のみ整数で。読めなければ null
- confidence: 0-1 の数値で抽出全体の確信度

不明・推測しかできない場合は null を必ず返し、推測値で埋めないでください。`;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function isPocEnabled(): boolean {
  // production では問答無用で無効。NODE_ENV を二重ガードに使い、誤設定で本番が
  // 認証なし Gemini プロキシ化することを防ぐ（Vercel preview も production 扱いになる点に注意）。
  if (process.env.NODE_ENV === "production") return false;
  return process.env.YUTAI_SCAN_POC_ENABLED === "1";
}

export async function POST(request: Request) {
  // PoC エンドポイントは development 環境で enable フラグが立っているときだけ受け付ける。
  // 存在自体を伏せる目的で 404 を返す。
  if (!isPocEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { imageBase64, mimeType } = body;
  if (!imageBase64 || !mimeType) {
    return NextResponse.json(
      { error: "imageBase64 and mimeType are required" },
      { status: 400 }
    );
  }

  const geminiBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", nullable: true },
          company: { type: "STRING", nullable: true },
          expiresOn: { type: "STRING", nullable: true },
          amountYen: { type: "INTEGER", nullable: true },
          quantity: { type: "INTEGER", nullable: true },
          confidence: { type: "NUMBER" },
        },
        required: ["confidence"],
      },
    },
  };

  const model = modelName();
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Gemini request failed", detail: String(e) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    // 503 (UNAVAILABLE) / 429 (RESOURCE_EXHAUSTED) は混雑・レート制限なので
    // クライアントにそのまま伝えて再試行を促す。
    const upstream = res.status;
    const retryable = upstream === 503 || upstream === 429;
    return NextResponse.json(
      {
        error: data.error?.message ?? "Gemini error",
        upstreamStatus: upstream,
        retryable,
        model,
      },
      { status: retryable ? upstream : 502 }
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json(
      { error: "empty response from Gemini", raw: data },
      { status: 502 }
    );
  }

  try {
    const parsed = JSON.parse(text);
    return NextResponse.json({ result: parsed, model });
  } catch {
    return NextResponse.json(
      { error: "Gemini returned non-JSON", text, model },
      { status: 502 }
    );
  }
}
