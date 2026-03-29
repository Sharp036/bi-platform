-- Add REPORT_SHARE permission and grant it to ADMIN and EDITOR roles
INSERT INTO dl_permission (code, description)
VALUES ('REPORT_SHARE', 'Share reports with users and roles')
ON CONFLICT (code) DO NOTHING;

INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM dl_role r, dl_permission p
WHERE r.name IN ('ADMIN', 'EDITOR') AND p.code = 'REPORT_SHARE'
ON CONFLICT DO NOTHING;
