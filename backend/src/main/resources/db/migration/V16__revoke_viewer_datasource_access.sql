-- Remove datasource access from basic VIEWER role.
DELETE FROM dl_role_permission rp
USING dl_role r, dl_permission p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'VIEWER'
  AND p.code = 'DATASOURCE_VIEW';

