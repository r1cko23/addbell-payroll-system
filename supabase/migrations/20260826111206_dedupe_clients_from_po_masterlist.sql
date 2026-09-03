-- Deduplicate clients using PO masterlist as the name source of truth.
-- Near-duplicates are matched by alphanumeric-only identity
-- (e.g. "PREMIUM BIKES CORPORATION" vs "PREMIUMBIKES CORPORATION").

-- 1) Rename clients to the most common masterlist spelling for the same identity.
with master_canon as (
  select
    lower(regexp_replace(trim(client_name), '[^a-zA-Z0-9]', '', 'g')) as norm,
    trim(client_name) as name,
    count(*)::int as n,
    row_number() over (
      partition by lower(regexp_replace(trim(client_name), '[^a-zA-Z0-9]', '', 'g'))
      order by count(*) desc, trim(client_name) asc
    ) as rn
  from po_masterlist_jobs
  where coalesce(trim(client_name), '') <> ''
  group by 1, 2
)
update clients c
set
  name = mc.name,
  updated_at = now()
from master_canon mc
where mc.rn = 1
  and lower(regexp_replace(c.name, '[^a-zA-Z0-9]', '', 'g')) = mc.norm
  and c.name is distinct from mc.name;

-- 2) Merge near-duplicate client rows onto a single keeper.
do $$
declare
  r record;
begin
  for r in
    with ranked as (
      select
        c.id,
        c.name,
        lower(regexp_replace(c.name, '[^a-zA-Z0-9]', '', 'g')) as norm,
        exists (
          select 1
          from po_masterlist_jobs j
          where lower(trim(j.client_name)) = lower(trim(c.name))
        ) as exact_master,
        coalesce((
          select count(*)::int from po_masterlist_jobs j where j.client_id = c.id
        ), 0) as job_fk_count,
        coalesce((
          select count(*)::int from projects p where p.client_id = c.id
        ), 0) as project_count,
        c.created_at,
        row_number() over (
          partition by lower(regexp_replace(c.name, '[^a-zA-Z0-9]', '', 'g'))
          order by
            case
              when exists (
                select 1
                from po_masterlist_jobs j
                where lower(trim(j.client_name)) = lower(trim(c.name))
              ) then 0
              else 1
            end,
            coalesce((
              select count(*)::int from po_masterlist_jobs j where j.client_id = c.id
            ), 0) desc,
            coalesce((
              select count(*)::int from projects p where p.client_id = c.id
            ), 0) desc,
            c.created_at asc nulls last,
            c.id asc
        ) as rn
      from clients c
      where coalesce(trim(c.name), '') <> ''
    ),
    pairs as (
      select
        d.id as dupe_id,
        k.id as keep_id
      from ranked d
      join ranked k
        on k.norm = d.norm
       and k.rn = 1
      where d.rn > 1
    )
    select dupe_id, keep_id from pairs
  loop
    update projects
    set client_id = r.keep_id,
        updated_at = now()
    where client_id = r.dupe_id;

    update po_masterlist_jobs
    set client_id = r.keep_id,
        updated_at = now()
    where client_id = r.dupe_id;

    delete from clients where id = r.dupe_id;
  end loop;
end $$;
