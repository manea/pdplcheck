# PDPLCheck — $0 Deployment & Ethical Launch Guide

## 1. Zero-Budget Deployment Options (`$0/month`)

### Path A: Cloudflare Workers Static Assets (Recommended Static `$0` Hosting)
- Commercially safe `$0` static hosting configured via `wrangler.jsonc` (`./dist`, SPA routing).
- All RoPA audits, cross-border transfer checks, 72h SDAIA breach clock calculations, bulk CSV batch checks, bilingual privacy notice generation, SHA-256 sealing, and A4 PDF printing run 100% locally in the browser (`localStorage` persistence).

```bash
npm run build
npx wrangler login
npx wrangler deploy
```

### Path B: Self-Hosted Node 22 + SQLite WAL (`Docker` / `systemd`)
1. **Docker Compose** (`127.0.0.1:4199`):
   ```bash
   docker compose up -d --build
   ```
   Reverse proxy via `deploy/Caddyfile`.
2. **Systemd + Online SQLite Backups**:
   - Template unit: `deploy/pdplcheck.service`
   - Online `VACUUM INTO` 14-day backup script: `deploy/backup-sqlite.sh`

---

## 2. Ethical Organic Distribution Drafts (`$0` Marketing)

- **Target Communities**:
  - UAE & Saudi SaaS founders, e-commerce engineering leads, FinTech teams, and mobile app studios preparing **RoPA registers**, **cross-border cloud safeguards**, **Arabic privacy notices**, and **72-hour breach triage playbooks**.
  - Open-source privacy engineering builders on GitHub (`pdpl`, `saudi-pdpl`, `uae-pdpl`, `sdaia`, `ropa`, `privacy-notice`, `cross-border-data`, `breach-notification`).
- **Mandatory Positioning Guardrail**:
  - State clearly that PDPLCheck runs locally with zero vendor lock-in and does **not** replace legal counsel or an accredited DPO, does **not** represent **SDAIA** (`سدايا`) or the **UAE Data Office**, and does **not** file regulatory breach reports or transfer permits automatically.
