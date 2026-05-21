import { runFullClipping } from "../src/run.js";

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // Auth: Vercel Cron envía Authorization: Bearer ${CRON_SECRET}
  // También aceptamos invocación manual con el mismo header.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res
      .status(500)
      .json({ ok: false, error: "CRON_SECRET no configurado en Vercel" });
  }

  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // Parámetros opcionales: ?days=14 y ?dry=1
  const url = new URL(req.url, `http://${req.headers.host}`);
  const days = parseInt(url.searchParams.get("days") || "7", 10);
  const dryRun = url.searchParams.get("dry") === "1";

  try {
    const summary = await runFullClipping({ days, dryRun });
    return res.status(200).json(summary);
  } catch (err) {
    console.error("Clipping error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
