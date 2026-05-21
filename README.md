# Activum Clipping Agent

Agente de vigilancia de medios para el departamento de Comunicación de Activum.
Se despliega en Vercel y se dispara cada lunes automáticamente vía Vercel Cron.
El informe semanal se envía por **email** (Resend) al destinatario configurado.
Sustituye herramientas de pago (Meltwater, Mention) con un ahorro estimado de 3.600–4.800 €/año.

---

## Cómo funciona

1. **Vercel Cron** llama cada lunes a las 06:00 UTC (≈ 07:00 Madrid en invierno, 08:00 en verano) al endpoint `/api/clipping`.
2. El endpoint verifica el header `Authorization: Bearer ${CRON_SECRET}`.
3. Lanza en paralelo búsquedas web vía la API de Anthropic (`web_search`) sobre los 3 bloques de keywords definidos en [config/keywords.js](config/keywords.js).
4. Deduplica, filtra por relevancia, genera un resumen ejecutivo y manda el informe HTML completo por email vía Resend.

---

## Estructura

```
ia_clipping/
├── api/
│   └── clipping.js        # Endpoint HTTP que Vercel Cron dispara
├── src/
│   ├── api.js             # Modelo + headers de la API de Anthropic
│   ├── env.js             # Loader de .env (solo dev local)
│   ├── run.js             # Orquestador compartido
│   ├── clipping.js        # Búsqueda, deduplicación, filtrado
│   ├── report.js          # Resumen ejecutivo + HTML
│   └── email.js           # Envío vía Resend
├── config/
│   └── keywords.js        # ← EDITAR AQUÍ: keywords, fuentes, umbrales
├── vercel.json            # Configuración del cron
├── package.json
└── .env.example
```

---

## Despliegue paso a paso

### 1. Crear el repo en GitHub (manual)

En https://github.com/new crea un repo vacío (privado recomendado). **No** añadas README, .gitignore ni licencia desde la UI.

Luego, desde la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 2. Crear cuenta en Resend y verificar dominio

1. Sign up en https://resend.com (gratis, 3.000 emails/mes).
2. **API Keys → Create API Key**. Guarda el valor `re_...` para el siguiente paso.
3. **Domains → Add Domain**: añade `activum.com` (o el dominio que vayas a usar como remitente).
4. Resend te da unos registros DNS (SPF, DKIM, MX). Añádelos en el panel de tu proveedor de DNS y espera a que Resend marque el dominio como **Verified**.
5. Mientras esté pendiente, puedes probar con `EMAIL_FROM=onboarding@resend.dev` enviando **solo a la dirección de tu cuenta Resend**.

### 3. Conectar el repo a Vercel

1. https://vercel.com/new → importa el repo.
2. **Framework Preset**: "Other".
3. **Build / Output**: déjalos vacíos.
4. Antes de "Deploy", añade las variables de entorno del paso siguiente.

### 4. Variables de entorno en Vercel

En **Project Settings → Environment Variables** añade con scope **Production**:

| Nombre | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `RESEND_API_KEY` | `re_...` |
| `EMAIL_FROM` | `clipping@activum.com` (dominio verificado en Resend) |
| `EMAIL_TO` | `comunicacion@activum.com` (acepta varias separadas por coma) |
| `CRON_SECRET` | Genera uno con `openssl rand -hex 32` |

Después haz **Deploy**.

### 5. Verificar el cron

En **Project → Cron Jobs** verás `/api/clipping` programado a `0 6 * * 1`. Pulsa "Run" para disparar una ejecución manual y comprobar que llega el email.

---

## Configuración de keywords

Edita [config/keywords.js](config/keywords.js):

```js
keywords: {
  marca: [
    "Activum",
    "Activum Homes",
    "Nombre del Proyecto",   // ← añade proyectos activos aquí
  ],
  sector: [ "promoción residencial Madrid", /* ... */ ],
  macro:  [ "precio vivienda España", /* ... */ ],
}
```

Otros parámetros configurables:
- `relevanceThreshold` (0–1): filtra resultados poco relevantes
- `maxPerBlock`: máximo de fichas por bloque
- `prioritySources`: medios que se priorizan en el ranking

Cualquier cambio aquí se despliega automáticamente al hacer `git push` (Vercel redeploya cada push a `main`).

---

## Desarrollo local

```bash
# 1. Copia las variables de entorno
cp .env.example .env
# Edita .env con valores reales

# 2. Levanta el endpoint en local
npx vercel dev

# 3. Dispara el endpoint (en otra terminal)
curl -H "Authorization: Bearer $(grep CRON_SECRET .env | cut -d= -f2)" \
     "http://localhost:3000/api/clipping?dry=1"
```

Parámetros opcionales en query string:
- `?days=14` — amplía la ventana de búsqueda (por defecto 7)
- `?dry=1` — genera el informe pero **no** envía el email

---

## Limitaciones del plan Hobby

- **Timeout: 60s por invocación.** Las búsquedas se ejecutan en paralelo para caber en ese margen. Si añades muchas keywords podría agotarse — reduce `maxPerBlock` o pasa a plan Pro (hasta 300s).
- **Cron: 1 ejecución por semana** está holgadamente dentro de los límites de Hobby.

---

## Costes estimados

- 3 llamadas con `web_search` (en paralelo) + 1 para el resumen ejecutivo
- **< 0,10 € por ejecución** con Sonnet 4.6
- **< 0,50 € al mes** en tokens de API
- Resend Hobby: **gratis** (3.000 emails/mes)
- Vercel Hobby: **gratis**
