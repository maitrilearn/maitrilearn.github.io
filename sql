create table experiences (
  id uuid primary key default gen_random_uuid(),
  content text,
  category text,
  created_at timestamp default now()
);

create table businesses (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  category text,
  created_at timestamp default now()
);



alter table experiences enable row level security;
alter table businesses enable row level security;

create policy "public_read_exp"
on experiences for select using (true);

create policy "public_insert_exp"
on experiences for insert with check (true);

create policy "public_read_business"
on businesses for select using (true);

create policy "public_insert_business"
on businesses for insert with check (true);




-- Experience
create table experiences (
  id uuid default gen_random_uuid() primary key,
  content text,
  category text,
  created_at timestamp default now()
);

-- Business
create table businesses (
  id uuid default gen_random_uuid() primary key,
  title text,
  description text,
  category text,
  created_at timestamp default now()
);

-- Call Queue
create table call_queue (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  created_at timestamp default now()
);

