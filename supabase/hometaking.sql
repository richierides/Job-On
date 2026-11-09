-- Additive Hometaking storage. Existing rooms/tasks/accounts remain untouched.
create table if not exists public.ht_documents (
 household_id uuid not null references public.households(id),
 id text not null, kind text not null check(kind in ('room','tasks')),
 payload jsonb not null, revision uuid not null, deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(household_id,id)
);
create table if not exists public.ht_history (
 household_id uuid not null references public.households(id), id text not null,
 revision uuid not null, payload jsonb not null, deleted boolean not null,
 created_at timestamptz not null default now(), primary key(household_id,id,revision)
);
alter table public.ht_documents enable row level security;
alter table public.ht_history enable row level security;
create policy ht_documents_read on public.ht_documents for select to authenticated using(public.is_household_member(household_id));
create policy ht_documents_insert on public.ht_documents for insert to authenticated with check(public.is_household_member(household_id));
create policy ht_documents_update on public.ht_documents for update to authenticated using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));
create policy ht_history_read on public.ht_history for select to authenticated using(public.is_household_member(household_id));
create policy ht_history_insert on public.ht_history for insert to authenticated with check(public.is_household_member(household_id));
grant select on public.ht_documents to authenticated;
revoke insert,update,delete on public.ht_documents from authenticated,anon;
grant select on public.ht_history to authenticated;
revoke insert,update,delete on public.ht_history from authenticated,anon;
-- Atomically compare expected revision and append immutable history. Client mutation
-- UUID makes retry after a lost response idempotent. No last-write-wins upsert.
create or replace function public.ht_save_document(p_household uuid,p_id text,p_kind text,p_payload jsonb,p_expected uuid,p_mutation uuid,p_deleted boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare current_doc public.ht_documents;
begin
 if auth.uid() is null or not public.is_household_member(p_household) then raise exception 'Not a household member' using errcode='42501'; end if;
 if p_mutation is null or length(p_id)>150 or octet_length(p_payload::text)>4000000 then raise exception 'Invalid document'; end if;
 if p_kind='room' and (p_payload->>'id' is distinct from p_id or jsonb_typeof(p_payload->'items') is distinct from 'array') then raise exception 'Invalid room'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_household::text||':'||p_id,0));
 select * into current_doc from public.ht_documents where household_id=p_household and id=p_id;
 if current_doc.revision=p_mutation then return p_mutation; end if;
 if current_doc.revision is distinct from p_expected then raise exception 'Room changed on another device' using errcode='40001'; end if;
 insert into public.ht_documents(household_id,id,kind,payload,revision,deleted) values(p_household,p_id,p_kind,p_payload,p_mutation,p_deleted)
 on conflict(household_id,id) do update set payload=excluded.payload,revision=excluded.revision,deleted=excluded.deleted,updated_at=now();
 insert into public.ht_history(household_id,id,revision,payload,deleted) values(p_household,p_id,p_mutation,p_payload,p_deleted);
 return p_mutation;
end $$;
revoke all on function public.ht_save_document(uuid,text,text,jsonb,uuid,uuid,boolean) from public,anon;
grant execute on function public.ht_save_document(uuid,text,text,jsonb,uuid,uuid,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit) values('hometaking','hometaking',false,10000000) on conflict(id) do nothing;
create policy ht_assets_read on storage.objects for select to authenticated using(bucket_id='hometaking' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy ht_assets_insert on storage.objects for insert to authenticated with check(bucket_id='hometaking' and public.is_household_member(((storage.foldername(name))[1])::uuid));
