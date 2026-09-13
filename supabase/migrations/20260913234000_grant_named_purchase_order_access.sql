-- Named overlay: Carizza Leonardo keeps operations_manager, but can open
-- and create purchase orders. Cristina's dashboard login is created separately
-- and matched by profiles.employee_id.
UPDATE public.profiles
SET
  permissions = COALESCE(permissions, '{}'::jsonb) || '{
    "purchase_orders": {"create": true, "read": true, "update": true, "delete": false}
  }'::jsonb,
  updated_at = now()
WHERE id = '4ed5c668-bef6-4373-8e9f-1af55ef10f09'
  AND full_name ILIKE '%carizza%leonardo%';
