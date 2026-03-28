-- Drop unused cascade columns: dependencies are now auto-detected from SQL :param references
ALTER TABLE dl_parameter_control DROP COLUMN IF EXISTS cascade_parent;
ALTER TABLE dl_parameter_control DROP COLUMN IF EXISTS cascade_field;
