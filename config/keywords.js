/**
 * config/keywords.js
 * Configuración central del agente: keywords, fuentes y umbrales.
 * Carlos puede editar este archivo sin tocar el código del agente.
 */

export function loadConfig() {
  return {
    // ── Keywords por bloque ────────────────────────────────────────────
    keywords: {
      marca: [
        "Activum",
        "Activum Homes",
        // Añade aquí nombres de proyectos activos, ej:
        // "Activum Serrano", "Activum La Moraleja"
      ],
      sector: [
        "promoción residencial Madrid",
        "vivienda de lujo Madrid",
        "obra nueva Madrid",
        "promotora inmobiliaria Madrid",
        "residencial alto standing Madrid",
        "vivienda premium España",
      ],
      macro: [
        "precio vivienda España",
        "hipoteca tipo interés España",
        "ley vivienda España",
        "mercado inmobiliario España 2026",
        "euribor vivienda",
        "obra nueva visados España",
      ],
    },

    // ── Fuentes prioritarias (se incluyen en queries site:) ────────────
    // El agente busca en abierto; estas fuentes se priorizan en el ranking
    prioritySources: [
      "idealista.com",
      "brainsre.news",
      "elconfidencial.com",
      "cincodias.elpais.com",
      "expansion.com",
      "lavanguardia.com",
      "elmundo.es",
      "fotocasa.es",
    ],

    // ── LinkedIn: búsqueda via Google site: ───────────────────────────
    linkedinSearch: true,

    // ── Cobertura geográfica ──────────────────────────────────────────
    geo: { gl: "es", hl: "es" }, // España, castellano

    // ── Umbral de relevancia (0-1) ────────────────────────────────────
    // Fichas con score < threshold se descartan
    relevanceThreshold: 0.35,

    // ── Máximo de fichas por bloque en el informe ─────────────────────
    maxPerBlock: 8,

    // ── Nombre de la empresa (para el informe) ────────────────────────
    companyName: "Activum",
  };
}
