-- Indexes for frequently listed reference entities (clients, projects, vendors).

CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients (name);
CREATE INDEX IF NOT EXISTS idx_clients_is_active_name ON public.clients (is_active, name);

CREATE INDEX IF NOT EXISTS idx_projects_name ON public.projects (name);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors (name);
CREATE INDEX IF NOT EXISTS idx_vendors_type_active_name ON public.vendors (type, is_active, name);
