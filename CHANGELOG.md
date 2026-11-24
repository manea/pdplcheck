# Changelog — PDPLCheck | رقيب خصوصية الخليج

> **تنبيه النطاق القانوني الإلزامي:** أداة «PDPLCheck» مساحة هندسية لتجهيز سجلات أنشطة المعالجة (`RoPA`) وفحص مخاطر النقل عبر الحدود وتجهيز مسودات إشعارات الخصوصية ومؤقت حوادث الـ `72 ساعة` وفق نظامي حماية البيانات في الإمارات (`45/2021`) والسعودية (`SDAIA PDPL`) — وليست استشارة قانونية معتمدة ولا تمثّل «سدايا» أو «مكتب الإمارات للبيانات»، ولا تغني عن تعيين `DPO` أو طلبات الموافقات التنظيمية الرسمية.

## [0.5.0] — 2026-11-24 — الإطلاق الإنتاجي المفتوح المصدر (`v0.5.0`)
- ترقية [`package.json`](package.json) إلى `0.5.0` وإضافة رخصة [`LICENSE`](LICENSE) (`MIT`) وسير عمل [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`Node 22`: `typecheck`, `test`, `build`).
- حفظ `6` لقطات واجهة حية من اختبارات Chrome في [`docs/screenshots/`](docs/screenshots/) وإضافة رابط النسخة الحية في [`launch/DEPLOY-AND-SHARE.md`](launch/DEPLOY-AND-SHARE.md).
- إنشاء بوابة التعقيم والتصدير [`deploy/export-public-github.sh`](deploy/export-public-github.sh) واجتياز فحص الخصوصية (`EXPORT_CLEAN_OK`).

## [0.4.0] - 2026-11-24 — المرحلة 4 (مكتملة)
- إضافة اختبارات المتصفح الحقيقي Chrome عبر `Playwright E2E` في `tests/e2e/pdplcheck.spec.ts` على `:4200` (عبر `1280×800` و`390×844` بوضعَي `AR RTL / Alabaster Teal` و`EN LTR / Gulf Obsidian` وحفظ `6` لقطات QA) مع ضبط `playwright.config.ts`.
- معالجة 3 ملاحظات بصرية وتقنية كشفتها المراجعة البصرية وتتبع الاختبارات: التحديث الحي التلقائي لمصفوفة الضوابط الـ 10 عند تعديل الحقول (`recomputeLocalDossierMetrics`)، واستبدال `<iframe sandbox>` بمعاينة React متكيفة مع الوضعين الفاتح والداكن دون رسائل `about:srcdoc` مع إبقاء `HTML + JSON-LD` في المصدر والتنزيلات، وإزالة التكرار اللفظي وإضافة `dir="auto"` لحقول الغرض والمعالج.
- اجتياز `bash -n deploy/*.sh` و`tsc --noEmit` و**16/16** `Vitest` (`571ms`) و`vite build` (`619ms`) و**3/3** `Playwright E2E` (`8.9s`).

## [0.3.0] - 2026-11-24 — المرحلة 3 (مكتملة)
- بناء واجهة الويب التفاعلية ثنائية اللغة (`AR RTL` افتراضياً بمظهر **Alabaster Teal & Falcon Gold** `#FAF9F6/#0F766E/#B45309`، و`EN LTR` بمظهر **Gulf Obsidian Slate** `#0A0F14/#2DD4BF`) في `index.html`, `public/favicon.svg`, `src/index.css`, `src/main.tsx`, `src/lib/{basePath,i18n,api}.ts`.
- تطوير اللوحات التفاعلية الثلاث: `RopaAndOrgPanel.tsx` (هوية المتحكم وملفات الجهات + محرر سجل `RoPA` والنقل عبر الحدود)، و`BreachAndCsvPanel.tsx` (حاسبة ومؤقت الـ `72 ساعة` لسدايا ومكتب الإمارات للبيانات + مدقق ملفات `CSV` الجماعي المحمي من حقن الصيغ)، و`DossierPreviewAndPrint.tsx` (مصفوفة الضوابط الـ 10 + معاينة إشعار الخصوصية `HTML + JSON-LD` ثنائي اللغة ضمن `iframe` معزول + تصدير `HTML / Markdown / CSV (UTF-8 BOM) / A4 PDF`) + المسار العام للمشاركة `/r/:slugOrCode`.
- دعم العمل المزدوج التلقائي (`SQLite WAL :4199` عند توفر الخادم أو `$0 localStorage` عند الاستضافة الثابتة) وتصحيح `vite.config.ts` إلى `base: '/'` لضمان حقن `window.__PDPLCHECK_BASE__` ومسارات الأصول على المسار الأساسي والفرعي (`/pdplcheck/r/test-spa`).
- اجتياز `tsc --noEmit` و**16/16** `Vitest` (`711ms`) و`vite build` (`2145 modules` في `840ms`) وفحص التشغيل الحي `UI_SMOKE_OK 0.3.0 /pdplcheck ROOT=200 SPA=200 FAV=200 JS=200 BASE_INJECT=true`.

## [0.2.0] - 2026-11-24 — المرحلة 2 (مكتملة)
- بناء الخادم الاختياري `Node 22 + SQLite WAL` في `server/db.mjs` و`server/app.mjs` و`server/app.d.mts` و`server/index.mjs` على المنفذ `:4199`.
- توفير الترقيم الذري `PDPL-YYYY-0001` وبصمة `SHA-256` وأقفال عدم التعديل `409 DOSSIER_LOCKED / ALREADY_LOCKED`، وواجهات `/api/health` و`/api/presets` و`/api/audit-pdpl` و`/api/audit/ropa-csv` و`/api/profiles*` و`/api/dossiers*` و`/api/public/reports/:slugOrCode`.
- دعم مخارج التصدير (`privacy-notice.html`, `ropa.md`, `export.csv`, `summary`)، وحماية الحجم (`5 MB`)، ومحدد معدل الكتابة (`RATE_LIMITED 429`)، وحقن `BASE_PATH=/pdplcheck`.
- إضافة اختبارات التكامل في `tests/unit/serverIntegration.test.ts` واجتياز `tsc --noEmit` و**16/16** `Vitest` وفحص التشغيل الحي على `:4199` (`SERVER_SMOKE_OK`).

## [0.1.0] - 2026-11-24 — المرحلة 1 (مكتملة)
- توثيق المواصفة المرجعية لنظامي `UAE PDPL 45/2021` و`KSA SDAIA PDPL` في `research/15-pdplcheck-spec-and-architecture.md` مع الإخلاء القانوني الإلزامي.
- تأسيس بنية المشروع الصفرية في `projects/pdplcheck/` وتثبيت الاعتماديات.
- بناء النواة الصفرية المتطابقة (`src/core/{types.ts,pdplRules.ts,ropaAuditor.ts,breachAndNotice.ts,dossierDigest.ts,presets.ts}`) واجتياز `tsc --noEmit` و**9/9** اختبارات `Vitest` والاستيراد المباشر تحت `Node 22`.
