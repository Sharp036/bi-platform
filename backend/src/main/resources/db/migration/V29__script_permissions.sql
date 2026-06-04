-- Add SCRIPT_MANAGE / SCRIPT_EXECUTE permissions and grant them to ADMIN and EDITOR.
-- Server-side JavaScript execution (arbitrary code) must not be available to every
-- authenticated user; until now /scripts/** fell under .anyRequest().authenticated().
INSERT INTO dl_permission (code, description)
VALUES
    ('SCRIPT_MANAGE',  'Create, edit and delete server-side transform scripts'),
    ('SCRIPT_EXECUTE', 'Execute server-side transform scripts (runs JavaScript on the server)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM dl_role r, dl_permission p
WHERE r.name IN ('ADMIN', 'EDITOR')
  AND p.code IN ('SCRIPT_MANAGE', 'SCRIPT_EXECUTE')
ON CONFLICT DO NOTHING;
