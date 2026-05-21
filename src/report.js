/**
 * src/report.js
 * Genera el resumen ejecutivo (vía Claude) y el HTML del informe completo.
 */

import { MODEL, anthropicMessage } from "./api.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Resumen ejecutivo vía Claude API ─────────────────────────────────────

async function generateExecutiveSummary(results, companyName) {
  const fichasSummary = Object.entries(results.blocks)
    .map(([block, items]) => {
      if (!items.length) return `Bloque ${block}: sin menciones esta semana.`;
      return `BLOQUE ${block.toUpperCase()} (${items.length} fichas):\n${items
        .map(
          (i) =>
            `- [${i.tono?.toUpperCase()}] ${i.titular} (${i.fuente}, ${i.fecha_publicacion || "s.f."}) — ${i.resumen}`
        )
        .join("\n")}`;
    })
    .join("\n\n");

  const prompt = `Eres el director de comunicación de ${companyName}, firma española de promociones residenciales premium.

A continuación tienes el clipping de prensa de esta semana:

${fichasSummary}

Redacta un resumen ejecutivo de 3–4 párrafos en español con estas características:
- Tono directo, profesional y conciso. Segunda persona.
- Sentence case en todo (sin mayúsculas en mitad de frase salvo nombres propios).
- Destaca primero las menciones directas a ${companyName} (si las hay).
- Resume las tendencias más relevantes del sector y el contexto macro.
- Señala cualquier señal de alerta o riesgo identificado.
- No uses bullet points. Solo párrafos de prosa.
- Máximo 250 palabras.

Devuelve SOLO el texto del resumen, sin título ni encabezado.`;

  const data = await anthropicMessage({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = data.content?.find((b) => b.type === "text")?.text || "";
  return text.trim();
}

// ── Helpers HTML ──────────────────────────────────────────────────────────

function tonoBadge(tono) {
  const map = {
    positivo: { bg: "#e8f4e3", color: "#2d6a12", label: "Positivo" },
    negativo: { bg: "#fae8ec", color: "#8e2d44", label: "Alerta" },
    neutro: { bg: "#ebe3db", color: "#4b4845", label: "Neutro" },
  };
  const t = map[tono?.toLowerCase()] || map.neutro;
  return `<span style="display:inline-block;background:${t.bg};color:${t.color};border-radius:9999px;padding:2px 9px;font-size:11px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap">${t.label}</span>`;
}

function safeUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "#";
  if (/^https?:\/\//i.test(u)) return escapeHtml(u);
  return "#";
}

function fichaHTML(item) {
  return `
    <div style="background:#f5f3f2;border:0.5px solid rgba(31,29,26,.12);border-radius:12px;padding:16px 18px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
        <p style="font-size:14px;font-weight:500;color:#1f1d1a;line-height:1.4;margin:0;flex:1">
          <a href="${safeUrl(item.url)}" style="color:#1f1d1a;text-decoration:none">${escapeHtml(item.titular || "Sin titular")}</a>
        </p>
        ${tonoBadge(item.tono)}
      </div>
      <p style="font-size:11px;color:#8f8d8c;margin:0 0 8px">
        ${escapeHtml(item.fuente || "Fuente desconocida")} &nbsp;·&nbsp; ${escapeHtml(item.fecha_publicacion || "Fecha no disponible")}
      </p>
      <hr style="border:none;border-top:0.5px solid rgba(31,29,26,.08);margin:0 0 10px">
      <p style="font-size:13px;color:#4b4845;line-height:1.6;margin:0;font-weight:300">${escapeHtml(item.resumen || "")}</p>
    </div>`;
}

function blockHTML(title, items, count) {
  if (!items.length) return "";
  return `
    <div style="margin-bottom:28px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="font-family:'Georgia',serif;font-weight:400;font-size:19px;color:#1f1d1a;margin:0">${escapeHtml(title)}</h3>
        <span style="background:#1f1d1a;color:#f5f3f2;border-radius:9999px;padding:3px 10px;font-size:11px;font-weight:500">${count}</span>
      </div>
      ${items.map(fichaHTML).join("")}
    </div>`;
}

// ── HTML completo del informe ─────────────────────────────────────────────

function buildHTMLReport(results, executiveSummary, config) {
  const { weekLabel, dateRange, blocks } = results;
  const totalFichas = Object.values(blocks).reduce(
    (s, b) => s + b.length,
    0
  );

  const [year, mmdd] = weekLabel.split("_");
  const labelDate = `Semana del ${mmdd.slice(0, 2)}/${mmdd.slice(2)} · ${year}`;

  const blockTitles = {
    marca: "Marca y proyectos",
    sector: "Sector y competencia",
    macro: "Contexto macro",
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clipping ${escapeHtml(config.companyName)} · ${escapeHtml(labelDate)}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto+Serif:wght@300;400&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Roboto',sans-serif;background:#f5f3f2;color:#1f1d1a;padding:32px 16px}
  .container{max-width:680px;margin:0 auto}
</style>
</head>
<body>
<div class="container">

  <!-- Cabecera -->
  <div style="background:#1f1d1a;border-radius:16px;padding:32px;margin-bottom:20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <span style="font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#8f8d8c">${escapeHtml(config.companyName)} · Clipping semanal</span>
      <span style="font-size:12px;color:#4b4845;text-align:right">${escapeHtml(dateRange.from)} – ${escapeHtml(dateRange.to)}</span>
    </div>
    <h1 style="font-family:'Roboto Serif',serif;font-weight:300;font-size:28px;color:#f5f3f2;line-height:1.2;margin-bottom:8px">Informe de prensa semanal</h1>
    <p style="font-size:13px;font-weight:300;color:#8f8d8c">${totalFichas} menciones · ${Object.keys(blocks).length} bloques · España (nacional + Madrid/Barcelona)</p>
  </div>

  <!-- Métricas -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
    ${Object.entries(blocks)
      .map(
        ([block, items]) => `
      <div style="background:#fff;border:0.5px solid rgba(31,29,26,.12);border-radius:12px;padding:14px 16px">
        <p style="font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#8f8d8c;margin-bottom:4px">${escapeHtml(blockTitles[block] || block)}</p>
        <p style="font-family:'Roboto Serif',serif;font-size:22px;color:#1f1d1a">${items.length}</p>
      </div>`
      )
      .join("")}
  </div>

  <!-- Resumen ejecutivo -->
  <div style="background:#ebe3db;border-radius:12px;padding:24px;margin-bottom:28px">
    <p style="font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#8e2d44;margin-bottom:10px">Resumen ejecutivo</p>
    <p style="font-size:15px;font-weight:300;line-height:1.75;color:#1f1d1a">${escapeHtml(executiveSummary).replace(/\n\n/g, "</p><p style=\"font-size:15px;font-weight:300;line-height:1.75;color:#1f1d1a;margin-top:12px\">")}</p>
  </div>

  <!-- Bloques -->
  ${Object.entries(blocks)
    .map(([block, items]) =>
      blockHTML(blockTitles[block] || block, items, items.length)
    )
    .join("")}

  <!-- Footer -->
  <div style="border-top:1px solid rgba(31,29,26,.10);padding-top:16px;display:flex;justify-content:space-between;align-items:center;margin-top:8px">
    <p style="font-size:11px;color:#8f8d8c;line-height:1.5">
      Generado automáticamente · ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}<br>
      Fuentes: medios españoles nacionales y especializados en inmobiliario
    </p>
    <span style="font-size:12px;font-weight:500;letter-spacing:0.10em;text-transform:uppercase;color:#cccac9">${escapeHtml(config.companyName)}</span>
  </div>

</div>
</body>
</html>`;
}

// ── Export principal ──────────────────────────────────────────────────────

export async function renderReport(results, config) {
  const executiveSummary = await generateExecutiveSummary(
    results,
    config.companyName
  );

  const html = buildHTMLReport(results, executiveSummary, config);

  // Slack blocks: resumen para el mensaje principal
  const totalFichas = Object.values(results.blocks).reduce(
    (s, b) => s + b.length,
    0
  );

  return {
    html,
    executiveSummary,
    weekLabel: results.weekLabel,
    totalFichas,
    dateRange: results.dateRange,
    blocks: results.blocks,
    config,
  };
}
