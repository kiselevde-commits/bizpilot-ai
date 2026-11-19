-- Grants for the restricted n8n dedupe role (TZ 24.12).
--
-- The role itself is created by docker/n8n/init-db.sql (Docker) or manually
-- (local development). If the role is absent, this migration is a no-op.
-- The role must never be a superuser and must never get privileges on CRM tables.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n_dedupe') THEN
    -- Keep the privilege set minimal: no DELETE, no DDL, no sequences.
    EXECUTE 'REVOKE ALL ON TABLE "n8n_processed" FROM n8n_dedupe';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE "n8n_processed" TO n8n_dedupe';
    EXECUTE 'GRANT USAGE ON SCHEMA public TO n8n_dedupe';

    BEGIN
      EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO n8n_dedupe',
        current_database()
      );
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'n8n_dedupe: CONNECT grant skipped (insufficient privilege)';
    END;
  ELSE
    RAISE NOTICE 'n8n_dedupe role does not exist; skipping grants';
  END IF;
END
$$;
