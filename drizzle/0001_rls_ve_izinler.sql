-- 2. kilit: firma tablolarında satır düzeyi güvenlik. Ayrıntı: docs/superpowers/specs/2026-10-06-temel-design.md §6
-- FORCE: tablo sahibi (servis_owner) de kilide uyar; komut satırı araçları firma bağlamı kurmak zorundadır.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "users"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sessions"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "audit_log"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
-- Uygulama kullanıcısının izinleri (en az ayrıcalık). Personel silinmez, işlem geçmişi değiştirilmez.
GRANT USAGE ON SCHEMA public TO servis_app;--> statement-breakpoint
GRANT SELECT ON "tenants" TO servis_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "users" TO servis_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sessions" TO servis_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "audit_log" TO servis_app;
