-- All fixtures roll back. No user rooms are changed.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','0749e09e-bb2e-4cb8-84ec-2d07feaca1b2',true);
do $$
declare hid uuid='9fc26ee9-0aa0-4d56-b5bc-406d0dfffefe'; first_revision uuid=gen_random_uuid(); second_revision uuid=gen_random_uuid(); n integer;
begin
 perform public.ht_save_document(hid,'__qa_atomic__','room','{"id":"__qa_atomic__","items":[]}',null,first_revision,false);
 perform public.ht_save_document(hid,'__qa_atomic__','room','{"id":"__qa_atomic__","items":[]}',null,first_revision,false);
 select count(*) into n from public.ht_history where id='__qa_atomic__'; if n<>1 then raise exception 'retry duplicated history';end if;
 begin
  perform public.ht_save_document(hid,'__qa_atomic__','room','{"id":"__qa_atomic__","items":[]}',null,second_revision,false);
  raise exception 'stale revision was accepted';
 exception when serialization_failure then null;end;
 perform public.ht_save_document(hid,'__qa_atomic__','room','{"id":"__qa_atomic__","items":[]}',first_revision,second_revision,true);
 if not (select deleted from public.ht_documents where id='__qa_atomic__') then raise exception 'tombstone missing';end if;
 begin
  update public.ht_documents set deleted=false where id='__qa_atomic__';
  raise exception 'direct update bypassed revision check';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','4e2fa0aa-2243-4230-9ee5-8f63e7033184',true);
 select count(*) into n from public.ht_documents where id='__qa_atomic__';if n<>0 then raise exception 'cross-household read';end if;
 begin
  perform public.ht_save_document(hid,'__qa_atomic__','room','{"id":"__qa_atomic__","items":[]}',second_revision,gen_random_uuid(),false);
  raise exception 'cross-household write';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.ht_save_document(hid,'__qa_atomic__','room','{"id":"__qa_atomic__","items":[]}',second_revision,gen_random_uuid(),false);
  raise exception 'unauthenticated write';
 exception when insufficient_privilege then null;end;
end $$;
select 'PASS: revisions, idempotent retry, tombstones, direct-write protection, household isolation, missing authentication' as result;
rollback;
