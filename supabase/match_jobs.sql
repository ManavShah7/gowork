-- ============================================================================
-- match_jobs — pgvector retrieval for the matching pipeline (Bug 3 fix)
-- Run this once in the Supabase SQL editor (needs to create a function + index).
--
-- Does the §5 hard filters in SQL, then orders by cosine distance using the
-- `<=>` operator so the HNSW index does the work (not a JS cosine loop).
-- The query embedding comes in as text and is cast to vector(1536) so the
-- operator/index actually fire (`$1::vector`).
-- ============================================================================

-- 0. Make sure pgvector is available and the column is a real vector(1536).
--    (No-op if already true; safe to keep here for reproducibility.)
create extension if not exists vector;

-- 1. HNSW index for cosine distance. IF NOT EXISTS so re-running is harmless.
--    vector_cosine_ops pairs with the `<=>` operator below.
create index if not exists job_listings_embedding_hnsw
  on public.job_listings
  using hnsw (embedding vector_cosine_ops);

-- 2. The retrieval function.
create or replace function public.match_jobs(
  query_embedding text,        -- JSON array string, e.g. '[0.1,0.2,...]' (cast to vector below)
  user_job_types  text[],      -- e.g. ARRAY['internship','coop']
  blacklist       text[]       default '{}',   -- company substrings to exclude (case-insensitive)
  match_count     int          default 50
)
returns table (
  job_id          text,
  apply_url       text,
  company         text,
  title           text,
  description     text,
  location        text,
  job_type_clean  text,
  role_tags       text[],
  required_skills text[],
  nice_skills     text[],
  seniority_level text,
  similarity      float
)
language sql
stable
as $$
  -- Columns are cast to the declared return types so the function works whether
  -- job_id is uuid or text, role_tags is text[] or varchar[], etc.
  select
    j.job_id::text,
    j.apply_url::text,
    j.company::text,
    j.title::text,
    j.description::text,
    j.location::text,
    j.job_type_clean::text,
    j.role_tags::text[],
    j.required_skills::text[],
    j.nice_skills::text[],
    j.seniority_level::text,
    (1 - (j.embedding <=> (query_embedding::vector(1536))))::float as similarity
  from public.job_listings j
  where j.classified = true
    and j.is_direct_apply = true
    and j.embedding is not null
    and j.job_type_clean = any(user_job_types)
    and not exists (
      select 1 from unnest(blacklist) as b
      where b <> '' and lower(j.company) like '%' || lower(b) || '%'
    )
  order by j.embedding <=> (query_embedding::vector(1536)) asc
  limit match_count;
$$;
