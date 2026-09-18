-- Takes the seeded department and company-tool tiles live and points them at the modules.
--
-- This is the scripted form of what an admin does in Admin > Apps (set the address, add a
-- callback URL, switch the app to Live). It is data for one installation, not schema, so it
-- is not a migration: the catalog that migration 0002 seeds stays "coming soon" in code and
-- the platform's own tests keep describing it.
--
-- Safe to run again. A tile is only touched while it is still "coming soon", so an address an
-- admin has since changed is never overwritten, and grants use ON CONFLICT DO NOTHING.
--
--   docker compose exec -T postgres psql -U central -d identity < modules/open-departments.sql
--
-- (start-modules.ps1 runs it for you.)

BEGIN;

-- Department workspaces and the two company tools the workspace console serves.
-- /d/<slug> opens the console scoped to that department's tools.
UPDATE apps
SET status = 'active',
    launch_url = 'http://localhost:5174/d/' || slug,
    redirect_uris = ARRAY['http://localhost:5174/api/auth/callback/identity'],
    post_logout_redirect_uris = ARRAY['http://localhost:5174/']
WHERE status = 'coming_soon'
  AND slug IN ('sales', 'dispatch', 'accounts', 'finance', 'marketing', 'purchase', 'hr',
               'production', 'quality', 'requisitions', 'automation');

-- One chat for every department: rooms, threads, the AI assistant, and expense claims
-- filed in the thread.
UPDATE apps
SET status = 'active',
    launch_url = 'http://localhost:5174/chat',
    redirect_uris = ARRAY['http://localhost:5174/api/auth/callback/identity'],
    post_logout_redirect_uris = ARRAY['http://localhost:5174/']
WHERE status = 'coming_soon' AND slug = 'chat';

-- Projects is KCMS, the Plane-based work tracker (modules/kiran-mgmt).
UPDATE apps
SET status = 'active',
    launch_url = 'http://localhost:3020',
    redirect_uris = ARRAY['http://localhost:3020/api/auth/callback/identity'],
    post_logout_redirect_uris = ARRAY['http://localhost:3020/']
WHERE status = 'coming_soon' AND slug = 'projects';

-- Sales works the PO inbox and the PACT entry, alongside Purchase and Accounts (migration 0003).
INSERT INTO department_app_access (department_id, app_id, app_role_id)
SELECT d.id, a.id, r.id
FROM departments d
JOIN apps a ON a.slug = 'pact-automation'
JOIN app_roles r ON r.app_id = a.id AND r.key = 'member'
WHERE d.slug = 'sales'
ON CONFLICT DO NOTHING;

-- The seeded Example App points at localhost:3001, which the PACT API now owns, so the
-- tile would open a raw API. Only the untouched seed row is retired.
UPDATE apps
SET status = 'disabled'
WHERE slug = 'example' AND status = 'active' AND launch_url = 'http://localhost:3001';

COMMIT;
