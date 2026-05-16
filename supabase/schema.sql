-- G-Futures Guide System / Supabase schema
-- Supabase SQL Editor에 그대로 붙여넣어 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.allowed_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  created_at timestamptz default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_name text not null,
  brand_name text,
  status text not null default 'unpublished' check (status in ('unpublished', 'published', 'error')),
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.campaign_tabs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  share_token text not null unique,
  sku_name text not null,
  product_name text,
  brand_name text,
  brand_color text default '#2D5A3D',
  hero_title text,
  hero_subtitle text,
  status text not null default 'unpublished' check (status in ('unpublished', 'published', 'error')),
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.guide_sections (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.campaign_tabs(id) on delete cascade,
  section_type text not null check (section_type in ('basic', 'product', 'content', 'notice')),
  title_ja text not null,
  sort_order int default 0,
  is_collapsible boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.guide_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.guide_sections(id) on delete cascade,
  title_ko text,
  body_ko text,
  title_ja text,
  body_ja text,
  item_type text not null default 'text' check (item_type in ('text', 'appeal', 'scene', 'notice', 'hashtag', 'link')),
  sort_order int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid references public.campaign_tabs(id) on delete cascade,
  item_id uuid references public.guide_items(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video', 'external_link', 'youtube', 'google_drive')),
  file_url text,
  external_url text,
  title text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.glossary_global (
  id uuid primary key default gen_random_uuid(),
  korean text not null,
  japanese text not null,
  category text,
  created_at timestamptz default now()
);

create index if not exists idx_campaign_tabs_campaign_id on public.campaign_tabs(campaign_id);
create index if not exists idx_campaign_tabs_share_token on public.campaign_tabs(share_token);
create index if not exists idx_guide_sections_tab_id on public.guide_sections(tab_id);
create index if not exists idx_guide_items_section_id on public.guide_items(section_id);
create index if not exists idx_media_assets_item_id on public.media_assets(item_id);

alter table public.allowed_admins enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_tabs enable row level security;
alter table public.guide_sections enable row level security;
alter table public.guide_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.glossary_global enable row level security;

-- MVP 초기 정책: 로그인 사용자는 읽기/쓰기 가능. 실제 운영 전 allowed_admins 체크 미들웨어를 함께 사용합니다.
create policy "authenticated read campaigns" on public.campaigns for select to authenticated using (true);
create policy "authenticated write campaigns" on public.campaigns for all to authenticated using (true) with check (true);
create policy "authenticated read tabs" on public.campaign_tabs for select to authenticated using (true);
create policy "authenticated write tabs" on public.campaign_tabs for all to authenticated using (true) with check (true);
create policy "authenticated read sections" on public.guide_sections for select to authenticated using (true);
create policy "authenticated write sections" on public.guide_sections for all to authenticated using (true) with check (true);
create policy "authenticated read items" on public.guide_items for select to authenticated using (true);
create policy "authenticated write items" on public.guide_items for all to authenticated using (true) with check (true);
create policy "authenticated read media" on public.media_assets for select to authenticated using (true);
create policy "authenticated write media" on public.media_assets for all to authenticated using (true) with check (true);
create policy "authenticated read glossary" on public.glossary_global for select to authenticated using (true);
create policy "authenticated write glossary" on public.glossary_global for all to authenticated using (true) with check (true);
create policy "authenticated read allowed_admins" on public.allowed_admins for select to authenticated using (true);

-- 공개 가이드 페이지용: published 상태의 tab만 anon 읽기 허용.
create policy "public read published tabs" on public.campaign_tabs for select to anon using (status = 'published');
create policy "public read published sections" on public.guide_sections for select to anon using (
  exists (
    select 1 from public.campaign_tabs t
    where t.id = guide_sections.tab_id and t.status = 'published'
  )
);
create policy "public read published items" on public.guide_items for select to anon using (
  is_deleted = false and exists (
    select 1
    from public.guide_sections s
    join public.campaign_tabs t on t.id = s.tab_id
    where s.id = guide_items.section_id and t.status = 'published'
  )
);
create policy "public read published media" on public.media_assets for select to anon using (
  exists (
    select 1 from public.campaign_tabs t
    where t.id = media_assets.tab_id and t.status = 'published'
  )
  or exists (
    select 1
    from public.guide_items i
    join public.guide_sections s on s.id = i.section_id
    join public.campaign_tabs t on t.id = s.tab_id
    where i.id = media_assets.item_id and t.status = 'published'
  )
);
