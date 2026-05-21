/**
 * src/clipping.js
 * Motor principal: búsqueda web, deduplicación y análisis de tono.
 * Usa la API de Anthropic con web_search tool para cada bloque de keywords.
 */

import { ANTHROPIC_URL, MODEL, anthropicHeaders } from "./api.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function dateRangeLabel(days) {
  const now = new Date();
  const from = new Date(now - days * 86400000);
  return {
    from: from.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
    weekLabel: getWeekLabel(now),
  };
}

function getWeekLabel(date) {
  const year = date.getFullYear();
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay() + 1);
  const dd = String(start.getDate()).padStart(2, "0");
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  return `${year}_${mm}${dd}`;
}

function buildSearchPrompt(block, keywords, dateRange, prioritySources) {
  const sourceHint = prioritySources.slice(0, 5).join(", ");
  return `Eres un asistente de vigilancia de medios para Activum, firma española de gestión de promociones residenciales premium.

Busca noticias y artículos publicados entre ${dateRange.from} y ${dateRange.to} relacionados con estas palabras clave:
${keywords.map((k) => `- "${k}"`).join("\n")}

Instrucciones:
1. Haz como máximo 3 búsquedas combinando las palabras clave más representativas en una sola query (separadas por OR o juntas). NO busques cada keyword por separado. Prioriza medios españoles como: ${sourceHint} y otros de referencia nacional.
2. Para cada resultado relevante, extrae:
   - titular (texto exacto)
   - url
   - fuente (nombre del medio)
   - fecha_publicacion (YYYY-MM-DD, o null si no se puede determinar)
   - resumen (2 frases máximo en español explicando el contenido y su relevancia para el sector inmobiliario premium)
   - tono: "positivo" si el contexto es favorable para promotores/inversores, "negativo" si hay riesgos o regulación adversa, "neutro" en cualquier otro caso
   - relevancia: número entre 0 y 1 indicando cuánto afecta este artículo al sector residencial premium español
3. Descarta resultados que no sean noticias (anuncios de portales inmobiliarios, fichas de productos, etc.)
4. Devuelve SOLO un array JSON válido. Sin texto previo ni posterior. Sin markdown. Ejemplo:
[{"titular":"...","url":"...","fuente":"...","fecha_publicacion":"2026-05-19","resumen":"...","tono":"positivo","relevancia":0.8}]

Si no encuentras resultados relevantes devuelve: []`;
}

// ── Llamada a la API con web_search ───────────────────────────────────────

async function searchBlock(block, keywords, dateRange, config) {
  const prompt = buildSearchPrompt(
    block,
    keywords,
    dateRange,
    config.prioritySources
  );

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
          user_location: { type: "approximate", country: "ES" },
        },
      ],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // Extraer el texto de la respuesta (puede haber tool_use blocks intermedios)
  const textBlocks = data.content.filter((b) => b.type === "text");
  const rawText = textBlocks.map((b) => b.text).join("");

  // Parsear JSON — limpiar posibles fences de markdown
  const clean = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Encontrar el array JSON (puede haber texto explicativo antes/después)
  const jsonMatch = clean.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const items = JSON.parse(jsonMatch[0]);
    return Array.isArray(items) ? items : [];
  } catch {
    console.warn(`  ⚠  No se pudo parsear respuesta del bloque ${block}`);
    return [];
  }
}

// ── Deduplicación ─────────────────────────────────────────────────────────

function itemKey(item) {
  const normalUrl = (item.url || "")
    .toLowerCase()
    .replace(/\?.*$/, "")
    .replace(/\/$/, "");

  const normalTitle = (item.titular || "")
    .toLowerCase()
    .replace(/[^a-záéíóúñ\s]/g, "")
    .slice(0, 60)
    .trim();

  return normalUrl || normalTitle;
}

function deduplicateItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = itemKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Filtrado por relevancia y fecha ──────────────────────────────────────

function filterItems(items, config, dateRange) {
  return items.filter((item) => {
    // Relevancia mínima
    if ((item.relevancia || 0) < config.relevanceThreshold) return false;

    // Descartar si la fecha es claramente fuera de rango
    if (item.fecha_publicacion) {
      const itemDate = new Date(item.fecha_publicacion);
      const fromDate = new Date(dateRange.from);
      // Tolerancia: acepta hasta 30 días atrás para artículos de análisis
      const extendedFrom = new Date(fromDate - 30 * 86400000);
      if (itemDate < extendedFrom) return false;
    }

    return true;
  });
}

// ── Ordenar por relevancia y fecha ───────────────────────────────────────

function sortItems(items) {
  return [...items].sort((a, b) => {
    const relDiff = (b.relevancia || 0) - (a.relevancia || 0);
    if (Math.abs(relDiff) > 0.1) return relDiff;
    // Si relevancia similar, más reciente primero
    const dateA = a.fecha_publicacion || "0000";
    const dateB = b.fecha_publicacion || "0000";
    return dateB.localeCompare(dateA);
  });
}

// ── Runner principal ──────────────────────────────────────────────────────

export async function runClipping(config, days = 7) {
  const dateRange = dateRangeLabel(days);
  const blocks = {};
  let totalRaw = 0;

  // Búsquedas SECUENCIALES con espera entre llamadas para no superar el
  // rate limit de Anthropic Tier 1 (10K input tokens/min).
  // Cada llamada de web_search inyecta 3-5K tokens de resultados como input;
  // esperar ~65s entre llamadas garantiza que la ventana de un minuto se resetea.
  const RATE_LIMIT_WAIT_MS = 65 * 1000;
  const entries = Object.entries(config.keywords);

  for (let i = 0; i < entries.length; i++) {
    const [block, keywords] = entries[i];
    if (i > 0) {
      console.log(`   ⏳  Esperando ${RATE_LIMIT_WAIT_MS / 1000}s (rate limit Anthropic Tier 1)...`);
      await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS));
    }

    const raw = await searchBlock(block, keywords, dateRange, config);
    const filtered = filterItems(raw, config, dateRange);
    const deduped = deduplicateItems(filtered);
    const sorted = sortItems(deduped);
    const limited = sorted.slice(0, config.maxPerBlock);

    blocks[block] = limited;
    totalRaw += raw.length;
    console.log(
      `   Bloque "${block}": ${raw.length} resultados → ${deduped.length} únicos → ${limited.length} fichas`
    );
  }

  // Deduplicar también entre bloques (una misma noticia puede aparecer en varios)
  const allItems = Object.values(blocks).flat();
  const crossDeduped = deduplicateItems(allItems);
  const totalDeduplicated = crossDeduped.length;

  // Reconstruir bloques respetando la deduplicación cruzada (con claves normalizadas)
  const crossKeys = new Set(crossDeduped.map(itemKey));
  for (const block of Object.keys(blocks)) {
    blocks[block] = blocks[block].filter((i) => crossKeys.has(itemKey(i)));
  }

  return {
    blocks,
    total: totalRaw,
    deduplicated: totalDeduplicated,
    dateRange,
    weekLabel: dateRange.weekLabel,
  };
}
