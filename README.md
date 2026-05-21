# Activum Clipping Agent

Agente de vigilancia de medios para el departamento de Comunicación de Activum.
Se ejecuta cada lunes en **GitHub Actions** y entrega el informe semanal por **email** (Resend).
Sustituye herramientas de pago (Meltwater, Mention) con un ahorro estimado de 3.600–4.800 €/año.

---

## Cómo funciona

1. **GitHub Actions** dispara el workflow cada lunes a las 06:00 UTC (≈ 07:00 Madrid en invierno, 08:00 en verano).
2. El workflow ejecuta `node bin/run.js` con las credenciales en secrets.
3. El agente lanza búsquedas web vía la API de Anthropic (`web_search`) sobre los 3 bloques de keywords definidos en [config/keywords.js](config/keywords.js).
4. Las búsquedas son **secuenciales con espera de 65s entre llamadas** para no superar el rate limit del Tier 1 de Anthropic (10K input tokens/min).
5. Deduplica, filtra por relevancia, genera un resumen ejecutivo y manda el informe HTML completo por email vía Resend.

Tiempo total de ejecución: **~3-4 minutos**. GitHub Actions admite hasta 6h por job, sobra margen.

---

## Estructura

```
ia_clipping/
├── .github/workflows/
│   └── clipping.yml         # Cron + workflow_dispatch
├── bin/
│   └── run.js               # Entrypoint CLI (lo que ejecuta el workflow)
├── src/
│   ├── api.js               # Modelo + headers de la API de Anthropic
│   ├── env.js               # Loader de .env (solo dev local)
│   ├── run.js               # Orquestador
│   ├── clipping.js          # Búsqueda, deduplicación, filtrado
│   ├── report.js            # Resumen ejecutivo + HTML
│   └── email.js             # Envío vía Resend
├── config/
│   └── keywords.js          # ← EDITAR AQUÍ: keywords, fuentes, umbrales
├── package.json
└── .env.example
```

---

## Despliegue

### 1. Crear cuenta en Resend y obtener API key

1. Sign up en https://resend.com (gratis, 3.000 emails/mes).
2. **API Keys → Create API Key**. Guarda el valor `re_...`.
3. **Domains → Add Domain**: añade `activum.com` (o el dominio que vayáis a usar). Añade los registros DNS que indica Resend (SPF, DKIM) y espera a que el dominio aparezca como **Verified**.
4. **Atajo para probar antes de verificar el dominio**: usa `EMAIL_FROM=onboarding@resend.dev` con `EMAIL_TO` = el email con el que te registraste en Resend.

### 2. Añadir los Repository Secrets en GitHub

En https://github.com/activum-innovacion/clipping_agent/settings/secrets/actions añade estos 4 secrets:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (de [console.anthropic.com](https://console.anthropic.com/settings/keys)) |
| `RESEND_API_KEY` | `re_...` del paso 1 |
| `EMAIL_FROM` | `clipping@activum.com` (o `onboarding@resend.dev` para probar) |
| `EMAIL_TO` | `comunicacion@activum.com` (acepta varias separadas por coma) |

### 3. Probar manualmente

En https://github.com/activum-innovacion/clipping_agent/actions:
1. Selecciona el workflow **Weekly clipping**.
2. **Run workflow** → puedes elegir `dry_run: true` para validar sin enviar email, o dejarlo en `false` para envío real.

Si funciona, el cron semanal queda activado automáticamente.

---

## Configuración de keywords

Edita [config/keywords.js](config/keywords.js):

```js
keywords: {
  marca: [
    "Activum",
    "Activum Homes",
    "Nombre del Proyecto",
  ],
  sector: [ "promoción residencial Madrid", /* ... */ ],
  macro:  [ "precio vivienda España", /* ... */ ],
}
```

Otros parámetros:
- `relevanceThreshold` (0–1): filtra resultados poco relevantes
- `maxPerBlock`: máximo de fichas por bloque
- `prioritySources`: medios que se priorizan en el ranking

Cualquier cambio aquí se aplica en la siguiente ejecución (no hace falta redesplegar nada).

---

## Desarrollo local

```bash
cp .env.example .env
# Edita .env con valores reales

# Ejecuta el clipping completo
node bin/run.js

# Dry-run (sin enviar email)
node bin/run.js --dry-run

# Ventana ampliada
node bin/run.js --days=14
```

---

## Notas sobre rate limits

- **Anthropic Tier 1**: 10.000 input tokens/min. El agente espera 65s entre bloques para no excederlo.
- Si subes a **Tier 2** (depositando $5+ en console.anthropic.com), el límite pasa a 80K/min y se podrían eliminar las esperas. Para hacerlo, baja `RATE_LIMIT_WAIT_MS` en [src/clipping.js](src/clipping.js).

---

## Costes estimados

- 3 llamadas con `web_search` + 1 para el resumen ejecutivo: **< 0,10 €/ejecución** con Sonnet 4.6.
- Mensual: **< 0,50 €** en tokens de API.
- GitHub Actions: **gratis** (uso muy por debajo de la cuota).
- Resend Hobby: **gratis** (3.000 emails/mes).
