import { runClipping } from "./clipping.js";
import { renderReport } from "./report.js";
import { sendReportEmail } from "./email.js";
import { loadConfig } from "../config/keywords.js";

export async function runFullClipping({ days = 7, dryRun = false } = {}) {
  const config = loadConfig();

  console.log(`▶  Clipping · ventana ${days}d · dryRun=${dryRun}`);

  const results = await runClipping(config, days);
  console.log(
    `   Total: ${results.total} resultados, ${results.deduplicated} únicos`
  );

  const report = await renderReport(results, config);

  let emailResult = null;
  if (!dryRun) {
    emailResult = await sendReportEmail(report);
    console.log(`   ✅ Email enviado a ${emailResult.to.join(", ")} (id=${emailResult.id})`);
  } else {
    console.log("   ⏭  Dry-run: email omitido");
  }

  return {
    ok: true,
    weekLabel: report.weekLabel,
    totalFichas: report.totalFichas,
    porBloque: Object.fromEntries(
      Object.entries(results.blocks).map(([k, v]) => [k, v.length])
    ),
    dateRange: results.dateRange,
    email: emailResult,
  };
}
