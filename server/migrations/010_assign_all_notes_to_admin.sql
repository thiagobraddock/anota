-- Single-admin app now: every note belongs to the one real account,
-- regardless of which device/anonymous session originally created it.
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'prof.thiagoaso@gmail.com';

  IF admin_id IS NOT NULL THEN
    UPDATE notes SET owner_id = admin_id WHERE owner_id IS DISTINCT FROM admin_id;
  END IF;
END $$;
