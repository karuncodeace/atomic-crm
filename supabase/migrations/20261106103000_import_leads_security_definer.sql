-- import_leads now inserts today's call queue. Authenticated users can only
-- select call_assignments, so the function must run as its owner.

ALTER FUNCTION public.import_leads(text, jsonb) SECURITY DEFINER;
