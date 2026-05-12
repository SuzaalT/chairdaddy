// Client-side Anthropic API helper using user's stored key.
// Uses the official Messages API with a CORS-friendly header.
const MODEL = "claude-opus-4-5";

export type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export async function callAnthropic(opts: {
  apiKey: string;
  system?: string;
  messages: { role: "user" | "assistant"; content: string | AnthropicContent[] }[];
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 800,
      system: opts.system,
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t}`);
  }
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  return json.content?.map((c) => c.text ?? "").join("") ?? "";
}

export async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return { data: btoa(binary), mediaType: file.type || "image/jpeg" };
}
