

-- An answered call (any outcome but no_answer) stamps "connected" on the
-- contact and on its open lead(s); the leads table and call list show it.
CREATE OR REPLACE FUNCTION "public"."set_last_connected_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    if new.outcome = 'no_answer' then
        return new;
    end if;

    update public.contacts c
    set last_connected_at = new.created_at
    where c.id = new.contact_id
      and (c.last_connected_at is null or c.last_connected_at < new.created_at);

    update public.deals d
    set last_connected_at = new.created_at
    where d.archived_at is null
      and new.contact_id = any (d.contact_ids)
      and (d.last_connected_at is null or d.last_connected_at < new.created_at);

    return new;
end;
$$;
