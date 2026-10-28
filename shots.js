import { list } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    const { blobs } = await list({ prefix: "meta/", limit: 1000 });
    const items = await Promise.all(
      blobs.map(async (b) => {
        try {
          const r = await fetch(b.url);
          return await r.json();
        } catch { return null; }
      })
    );
    const out = items.filter(Boolean).sort((a, b) => a.ts - b.ts);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: "Could not load screenshots" });
  }
}
