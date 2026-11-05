-- Unapplied review migration. Original multi-design approval flow; no historical consent inferred.
begin;
alter table public.orders
  add column if not exists terms_version text,
  add column if not exists terms_snapshot jsonb,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists artwork_rights_accepted_at timestamptz;

create table public.artwork_jobs (
  id uuid primary key,
  order_id uuid unique references public.orders(id) on delete restrict,
  reference text not null check(length(reference) between 1 and 160),
  customer_name text not null check(length(customer_name) between 2 and 120),
  customer_email text not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  token_sealed text not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '30 days'),
  cancelled_at timestamptz
);
create table public.artwork_designs (
  id uuid primary key,
  job_id uuid not null references public.artwork_jobs(id) on delete restrict,
  name text not null check(length(name) between 1 and 160),
  current_revision integer not null default 0,
  unique(id,job_id)
);
create table public.artwork_proofs (
  id uuid primary key,
  job_id uuid not null references public.artwork_jobs(id) on delete restrict,
  design_id uuid not null,
  design_name text not null,
  revision integer not null check(revision>0),
  proof_path text not null unique,
  proof_filename text not null,
  proof_mime text not null check(proof_mime in ('application/pdf','image/png','image/jpeg','image/webp')),
  proof_sha256 text not null check(proof_sha256 ~ '^[a-f0-9]{64}$'),
  print_specs jsonb not null,
  order_snapshot jsonb,
  terms_version text not null,
  terms_snapshot jsonb not null,
  reviewer_name text not null check(length(reviewer_name) between 2 and 120),
  review_notes text not null check(length(review_notes) between 10 and 4000),
  reviewed_at timestamptz not null default now(),
  status text not null default 'pending' check(status in ('pending','approved','changes_requested','superseded')),
  created_at timestamptz not null default now(),
  submission_id uuid,
  responded_at timestamptz,
  signer_name text,
  signer_email text,
  signer_business text,
  approved_proof_ids uuid[],
  terms_accepted boolean not null default false,
  rights_confirmed boolean not null default false,
  proof_approved boolean not null default false,
  electronic_consent boolean not null default false,
  promotional boolean not null default false,
  promotional_restrictions text not null default '',
  change_notes text,
  unique(design_id,revision),
  foreign key(design_id,job_id) references public.artwork_designs(id,job_id) on delete restrict,
  check(status<>'approved' or(terms_accepted and rights_confirmed and proof_approved and electronic_consent and responded_at is not null and signer_email is not null and signer_name is not null)),
  check(not promotional or status='approved')
);
create index artwork_jobs_created_idx on public.artwork_jobs(created_at desc,id);
create index artwork_designs_job_idx on public.artwork_designs(job_id);
create index artwork_proofs_job_idx on public.artwork_proofs(job_id,design_id,revision desc);
alter table public.artwork_jobs enable row level security;
alter table public.artwork_designs enable row level security;
alter table public.artwork_proofs enable row level security;
revoke all on public.artwork_jobs,public.artwork_designs,public.artwork_proofs from public,anon,authenticated;
grant select,insert,update on public.artwork_jobs,public.artwork_designs,public.artwork_proofs to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('artwork-proofs','artwork-proofs',false,2097152,array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
create policy "Artwork proofs are server-only" on storage.objects as restrictive for all to anon,authenticated
using(bucket_id<>'artwork-proofs') with check(bucket_id<>'artwork-proofs');

create function public.artwork_order_snapshot(p_order_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object('items',o.items,'notes',o.order_notes,'email',lower(o.customer_email)) from public.orders o where o.id=p_order_id;
$$;

create function public.create_artwork_proof(p jsonb) returns public.artwork_proofs
language plpgsql security invoker set search_path='' as $$
declare
 j public.artwork_jobs; d public.artwork_designs; base public.artwork_proofs; result public.artwork_proofs;
 target_job uuid:=(p->>'job_id')::uuid; target_order uuid:=nullif(p->>'order_id','')::uuid;
 base_id uuid:=nullif(p->>'base_proof_id','')::uuid;
begin
 if p->'review_confirmed' is distinct from 'true'::jsonb then raise exception 'Complete the internal artwork and rights review first.' using errcode='P0001'; end if;
 if p->'terms_snapshot'->>'version' is distinct from p->>'terms_version' then raise exception 'Terms snapshot does not match its version.' using errcode='P0001'; end if;
 -- All mutations use the same lock order: linked order, job, design, proof.
 if target_order is not null then
  perform 1 from public.orders where id=target_order for update;
  if not found then raise exception 'Order not found.' using errcode='P0001'; end if;
  if exists(select 1 from public.orders where id=target_order and status in ('shipped','delivered','completed','cancelled')) then raise exception 'This order is closed. Start a new order for a reprint.' using errcode='P0001'; end if;
 end if;
 insert into public.artwork_jobs(id,order_id,reference,customer_name,customer_email,token_hash,token_sealed)
 values(target_job,target_order,p->>'reference',p->>'customer_name',lower(p->>'customer_email'),p->>'token_hash',p->>'token_sealed') on conflict(id) do nothing;
 select * into strict j from public.artwork_jobs where id=target_job for update;
 if j.cancelled_at is not null or j.order_id is distinct from target_order then raise exception 'This job is closed or its linked order changed.' using errcode='P0001'; end if;
 if j.customer_email is distinct from lower(p->>'customer_email') or j.reference is distinct from p->>'reference' then raise exception 'Use the existing job reference and customer email.' using errcode='P0001'; end if;
 if target_order is not null and j.customer_email is distinct from(select lower(customer_email) from public.orders where id=target_order) then raise exception 'Use the linked order customer email.' using errcode='P0001'; end if;
 if base_id is not null then
  select * into base from public.artwork_proofs where id=base_id and job_id=j.id;
  if not found then raise exception 'The proof does not belong to this order.' using errcode='P0001'; end if;
  select * into strict d from public.artwork_designs where id=base.design_id for update;
  if base.revision<>d.current_revision then raise exception 'A newer proof exists. Revise the current version.' using errcode='P0001'; end if;
  update public.artwork_proofs set status='superseded' where design_id=d.id and status='pending';
 else
  if(select count(*) from public.artwork_designs where job_id=j.id)>=200 then raise exception 'This job has reached 200 designs. Create another job.' using errcode='P0001'; end if;
  insert into public.artwork_designs(id,job_id,name) values((p->>'design_id')::uuid,j.id,p->>'design_name') returning * into d;
 end if;
 insert into public.artwork_proofs(id,job_id,design_id,design_name,revision,proof_path,proof_filename,proof_mime,proof_sha256,print_specs,order_snapshot,terms_version,terms_snapshot,reviewer_name,review_notes)
 values((p->>'id')::uuid,j.id,d.id,p->>'design_name',d.current_revision+1,p->>'proof_path',p->>'proof_filename',p->>'proof_mime',p->>'proof_sha256',p->'print_specs',public.artwork_order_snapshot(target_order),p->>'terms_version',p->'terms_snapshot',p->>'reviewer_name',p->>'review_notes') returning * into result;
 update public.artwork_designs set current_revision=result.revision,name=result.design_name where id=d.id;
 update public.artwork_jobs set version=version+1 where id=j.id;
 update public.orders set status='processing' where id=target_order and status in ('producing','qc_check');
 return result;
end;
$$;

create function public.respond_to_artwork_job(p_hash text,p jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare
 j public.artwork_jobs; proof public.artwork_proofs; decision jsonb; target_order uuid;
 chosen_ids uuid[]; approved_ids uuid[]; agreement_version text; total integer:=0;
 batch_id uuid:=gen_random_uuid(); response_time timestamptz:=statement_timestamp();
begin
 select order_id into target_order from public.artwork_jobs where token_hash=p_hash;
 if target_order is not null then
  perform 1 from public.orders where id=target_order for update;
  if exists(select 1 from public.orders where id=target_order and status='cancelled') then raise exception 'This order is cancelled.' using errcode='P0001'; end if;
 end if;
 select * into j from public.artwork_jobs where token_hash=p_hash for update;
 if not found or j.cancelled_at is not null or j.expires_at<=response_time then raise exception 'This approval link is closed or expired.' using errcode='P0001'; end if;
 if p->>'jobVersion' is null or (p->>'jobVersion')::integer<>j.version then raise exception 'Designs changed. Refresh the proofs and review the current versions.' using errcode='P0001'; end if;
 if coalesce(length(trim(p->>'signerName')),0) not between 2 and 120 or lower(trim(p->>'signerEmail')) is distinct from j.customer_email then raise exception 'Use your full name and the email this order was issued to.' using errcode='P0001'; end if;
 if jsonb_typeof(p->'decisions') is distinct from 'array' or jsonb_array_length(p->'decisions') not between 1 and 200 then raise exception 'Choose a response for at least one design.' using errcode='P0001'; end if;
 select array_agg((x->>'proofId')::uuid),array_agg((x->>'proofId')::uuid) filter(where x->>'action'='approve') into chosen_ids,approved_ids from jsonb_array_elements(p->'decisions') x;
 if cardinality(chosen_ids)<>(select count(distinct unnest) from unnest(chosen_ids)) then raise exception 'A design can have only one response per submission.' using errcode='P0001'; end if;
 if approved_ids is not null and(p->'consents' is distinct from '[true,true,true]'::jsonb or p->'electronicConsent' is distinct from 'true'::jsonb) then raise exception 'Confirm all three approval statements and the electronic signature intent.' using errcode='P0001'; end if;
 -- Validate the entire selection before recording any response.
 for decision in select * from jsonb_array_elements(p->'decisions') loop
  select a.* into proof from public.artwork_proofs a join public.artwork_designs d on d.id=a.design_id and d.current_revision=a.revision
   where a.id=(decision->>'proofId')::uuid and a.job_id=j.id for update of a;
  if not found or proof.status<>'pending' then raise exception 'A selected proof is stale, belongs to another order, or already has a response. Refresh the proofs.' using errcode='P0001'; end if;
  if decision->>'revision' is null or (decision->>'revision')::integer<>proof.revision or decision->>'proofSha256' is distinct from proof.proof_sha256 or decision->>'termsVersion' is distinct from proof.terms_version then raise exception 'The proof changed. Refresh and review it again.' using errcode='P0001'; end if;
  if target_order is not null and proof.order_snapshot is distinct from public.artwork_order_snapshot(target_order) then raise exception 'Order specifications changed. Request a new proof.' using errcode='P0001'; end if;
  if decision->>'action'='approve' then
   if agreement_version is not null and proof.terms_version<>agreement_version then raise exception 'Select designs with the same terms version, or submit them separately.' using errcode='P0001'; end if;
   agreement_version:=proof.terms_version;
  elsif decision->>'action'='request_changes' then
   if coalesce(length(trim(decision->>'changeNotes')),0) not between 1 and 4000 then raise exception 'Describe the requested changes for each selected design.' using errcode='P0001'; end if;
  else raise exception 'Choose approval or request changes.' using errcode='P0001'; end if;
 end loop;
 for decision in select * from jsonb_array_elements(p->'decisions') loop
  update public.artwork_proofs set
   status=case when decision->>'action'='approve' then 'approved' else 'changes_requested' end,
   submission_id=batch_id,responded_at=response_time,signer_name=trim(p->>'signerName'),signer_email=j.customer_email,signer_business=left(coalesce(trim(p->>'business'),''),160),
   approved_proof_ids=coalesce(approved_ids,'{}'),
   terms_accepted=(decision->>'action'='approve'),rights_confirmed=(decision->>'action'='approve'),proof_approved=(decision->>'action'='approve'),electronic_consent=(decision->>'action'='approve'),
   promotional=(decision->>'action'='approve' and coalesce(p->'promotional'='true'::jsonb,false)),
   promotional_restrictions=case when decision->>'action'='approve' and p->'promotional'='true'::jsonb then left(coalesce(trim(p->>'restrictions'),''),4000) else '' end,
   change_notes=case when decision->>'action'='request_changes' then trim(decision->>'changeNotes') else null end
   where id=(decision->>'proofId')::uuid;
  total:=total+1;
 end loop;
 return total;
end;
$$;

create function public.manage_artwork_link(p_job_id uuid,p_action text,p_hash text default null,p_sealed text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare target_order uuid;
begin
 select order_id into target_order from public.artwork_jobs where id=p_job_id;
 if target_order is not null then perform 1 from public.orders where id=target_order for update; end if;
 perform 1 from public.artwork_jobs where id=p_job_id for update;
 if not found then raise exception 'Job not found.' using errcode='P0001'; end if;
 if p_action='close' then
  if exists(select 1 from public.orders where id=target_order and status in ('shipped','delivered','completed')) then raise exception 'This order is fulfilled. Retain the record; links expire automatically.' using errcode='P0001'; end if;
  update public.artwork_jobs set cancelled_at=coalesce(cancelled_at,statement_timestamp()),version=version+1 where id=p_job_id;
  update public.orders set status='processing' where id=target_order and status in ('producing','qc_check');
 elsif p_action='replace' and p_hash ~ '^[a-f0-9]{64}$' and p_sealed is not null then
  if exists(select 1 from public.artwork_jobs where id=p_job_id and cancelled_at is not null) then raise exception 'This job is closed.' using errcode='P0001'; end if;
  update public.artwork_jobs set token_hash=p_hash,token_sealed=p_sealed,expires_at=statement_timestamp()+interval '30 days',version=version+1 where id=p_job_id;
 else raise exception 'Invalid link action.' using errcode='P0001'; end if;
end;
$$;

create function public.protect_artwork_proof_record() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' or old.status in ('approved','changes_requested') then raise exception 'Retain proof and response records; create a new revision instead.' using errcode='P0001'; end if;
 if(to_jsonb(new)-array['status','submission_id','responded_at','signer_name','signer_email','signer_business','approved_proof_ids','terms_accepted','rights_confirmed','proof_approved','electronic_consent','promotional','promotional_restrictions','change_notes'])
 is distinct from(to_jsonb(old)-array['status','submission_id','responded_at','signer_name','signer_email','signer_business','approved_proof_ids','terms_accepted','rights_confirmed','proof_approved','electronic_consent','promotional','promotional_restrictions','change_notes']) then raise exception 'Proofs, specifications, terms and review details are immutable. Create a new revision.' using errcode='P0001'; end if;
 return new;
end;
$$;
create trigger protect_artwork_proof_record before update or delete on public.artwork_proofs for each row execute function public.protect_artwork_proof_record();
create function public.require_artwork_approval_for_production() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('producing','qc_check','shipped','delivered','completed') and not exists(
  select 1 from public.artwork_jobs j where j.order_id=new.id and j.cancelled_at is null
   and exists(select 1 from public.artwork_designs d where d.job_id=j.id)
   and not exists(select 1 from public.artwork_designs d left join public.artwork_proofs p on p.design_id=d.id and p.revision=d.current_revision
    where d.job_id=j.id and(p.id is null or p.status<>'approved' or not p.terms_accepted or not p.rights_confirmed or not p.proof_approved or not p.electronic_consent or p.reviewed_at is null
     or p.order_snapshot is distinct from jsonb_build_object('items',new.items,'notes',new.order_notes,'email',lower(new.customer_email))))
 ) then raise exception 'Production is on hold: obtain approval of every current design and its specifications first.' using errcode='P0001'; end if;
 return new;
end;
$$;
create trigger require_artwork_approval_for_production before insert or update of status,items,order_notes,customer_email on public.orders for each row execute function public.require_artwork_approval_for_production();
revoke all on function public.artwork_order_snapshot(uuid),public.create_artwork_proof(jsonb),public.respond_to_artwork_job(text,jsonb),public.manage_artwork_link(uuid,text,text,text),public.protect_artwork_proof_record(),public.require_artwork_approval_for_production() from public,anon,authenticated;
grant execute on function public.artwork_order_snapshot(uuid),public.create_artwork_proof(jsonb),public.respond_to_artwork_job(text,jsonb),public.manage_artwork_link(uuid,text,text,text),public.protect_artwork_proof_record(),public.require_artwork_approval_for_production() to service_role;
notify pgrst,'reload schema';
commit;
