import { put } from "@vercel/blob";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

async function isMinecraft(base64) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 5,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          { type: "text", text: "Is this image an in-game screenshot of Minecraft (blocky voxel world, Minecraft UI, mobs, items or skins)? Reject photos of real life, other games, memes, art, or anything else. Answer only YES or NO." },
        ],
      }],
    }),
  });
  if (!r.ok) throw new Error("check failed");
  const j = await r.json();
  return (j.content?.[0]?.text || "").trim().toUpperCase().startsWith("YES");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const title = String(req.body?.title || "").replace(/[<>]/g, "").trim().slice(0, 40);
    const image = String(req.body?.image || "");
    const m = image.match(/^data:image\/jpeg;base64,(.+)$/);
    if (!title) return res.status(400).json({ error: "Please write a name." });
    if (!m) return res.status(400).json({ error: "Invalid image." });
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > 3.5 * 1024 * 1024) return res.status(400).json({ error: "Image is too big." });

    let ok;
    try { ok = await isMinecraft(m[1]); }
    catch { return res.status(503).json({ error: "Could not verify the image right now. Try again." }); }
    if (!ok) return res.status(422).json({ error: "Only Minecraft screenshots are allowed." });

    const ts = Date.now();
    const img = await put(`shots/${ts}.jpg`, buf, { access: "public", contentType: "image/jpeg", addRandomSuffix: true });
    const meta = { url: img.url, title, ts };
    await put(`meta/${ts}.json`, JSON.stringify(meta), { access: "public", contentType: "application/json", addRandomSuffix: true });
    res.status(200).json(meta);
  } catch (e) {
    res.status(500).json({ error: "Upload failed." });
  }
}
