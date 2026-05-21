const RESEND_URL = "https://api.resend.com/emails";

function parseRecipients(raw) {
  return String(raw || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function sendReportEmail(report) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = parseRecipients(process.env.EMAIL_TO);

  if (!apiKey) throw new Error("RESEND_API_KEY no configurado");
  if (!from) throw new Error("EMAIL_FROM no configurado (ej. clipping@tudominio.com)");
  if (!to.length) throw new Error("EMAIL_TO no configurado");

  const [year, mmdd] = report.weekLabel.split("_");
  const subject = `${report.config.companyName} · Clipping semanal ${mmdd.slice(0, 2)}/${mmdd.slice(2)}/${year} · ${report.totalFichas} menciones`;

  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: report.html,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return { ok: true, id: data.id, to, fichas: report.totalFichas };
}
