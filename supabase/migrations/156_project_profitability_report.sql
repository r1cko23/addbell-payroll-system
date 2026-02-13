-- =====================================================
-- PROJECT PROFITABILITY REPORT (PER CUTOFF / PERIOD)
-- =====================================================
-- Aggregates labor + material + other costs by period and all-time

CREATE OR REPLACE FUNCTION public.get_project_profitability_report(
  p_cutoff_start DATE,
  p_cutoff_end DATE,
  p_include_inactive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  project_id UUID,
  project_code TEXT,
  project_name TEXT,
  client_name TEXT,
  project_status TEXT,
  contract_amount NUMERIC,
  budget_amount NUMERIC,
  period_labor_cost NUMERIC,
  period_material_cost NUMERIC,
  period_other_cost NUMERIC,
  period_total_cost NUMERIC,
  all_time_labor_cost NUMERIC,
  all_time_material_cost NUMERIC,
  all_time_other_cost NUMERIC,
  all_time_total_cost NUMERIC,
  period_margin NUMERIC,
  period_margin_pct NUMERIC,
  all_time_margin NUMERIC,
  all_time_margin_pct NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      p.id AS project_id,
      p.project_code,
      p.project_name,
      COALESCE(c.client_name, c.name, '') AS client_name,
      p.project_status,
      COALESCE(p.contract_amount, 0)::NUMERIC AS contract_amount,
      COALESCE(p.budget_amount, 0)::NUMERIC AS budget_amount
    FROM public.projects p
    LEFT JOIN public.clients c ON c.id = p.client_id
    WHERE (p_include_inactive OR COALESCE(p.is_active, TRUE))
  ),
  period_material AS (
    SELECT project_id, COALESCE(SUM(total_cost), 0)::NUMERIC AS amount
    FROM public.project_costs
    WHERE cost_type = 'material'
      AND cost_date BETWEEN p_cutoff_start AND p_cutoff_end
    GROUP BY project_id
  ),
  period_other AS (
    SELECT project_id, COALESCE(SUM(total_cost), 0)::NUMERIC AS amount
    FROM public.project_costs
    WHERE cost_type IN ('machine', 'other')
      AND cost_date BETWEEN p_cutoff_start AND p_cutoff_end
    GROUP BY project_id
  ),
  period_labor AS (
    SELECT project_id, COALESCE(SUM(total_cost), 0)::NUMERIC AS amount
    FROM public.project_manpower_costs
    WHERE period_start_date >= p_cutoff_start
      AND period_start_date <= p_cutoff_end
    GROUP BY project_id
  ),
  all_material AS (
    SELECT project_id, COALESCE(SUM(total_cost), 0)::NUMERIC AS amount
    FROM public.project_costs
    WHERE cost_type = 'material'
    GROUP BY project_id
  ),
  all_other AS (
    SELECT project_id, COALESCE(SUM(total_cost), 0)::NUMERIC AS amount
    FROM public.project_costs
    WHERE cost_type IN ('machine', 'other')
    GROUP BY project_id
  ),
  all_labor AS (
    SELECT project_id, COALESCE(SUM(total_cost), 0)::NUMERIC AS amount
    FROM public.project_manpower_costs
    GROUP BY project_id
  )
  SELECT
    b.project_id,
    b.project_code,
    b.project_name,
    b.client_name,
    b.project_status,
    b.contract_amount,
    b.budget_amount,
    COALESCE(pl.amount, 0) AS period_labor_cost,
    COALESCE(pm.amount, 0) AS period_material_cost,
    COALESCE(po.amount, 0) AS period_other_cost,
    (COALESCE(pl.amount, 0) + COALESCE(pm.amount, 0) + COALESCE(po.amount, 0)) AS period_total_cost,
    COALESCE(al.amount, 0) AS all_time_labor_cost,
    COALESCE(am.amount, 0) AS all_time_material_cost,
    COALESCE(ao.amount, 0) AS all_time_other_cost,
    (COALESCE(al.amount, 0) + COALESCE(am.amount, 0) + COALESCE(ao.amount, 0)) AS all_time_total_cost,
    (b.contract_amount - (COALESCE(pl.amount, 0) + COALESCE(pm.amount, 0) + COALESCE(po.amount, 0))) AS period_margin,
    CASE
      WHEN b.contract_amount > 0
      THEN ((b.contract_amount - (COALESCE(pl.amount, 0) + COALESCE(pm.amount, 0) + COALESCE(po.amount, 0))) / b.contract_amount) * 100
      ELSE 0
    END AS period_margin_pct,
    (b.contract_amount - (COALESCE(al.amount, 0) + COALESCE(am.amount, 0) + COALESCE(ao.amount, 0))) AS all_time_margin,
    CASE
      WHEN b.contract_amount > 0
      THEN ((b.contract_amount - (COALESCE(al.amount, 0) + COALESCE(am.amount, 0) + COALESCE(ao.amount, 0))) / b.contract_amount) * 100
      ELSE 0
    END AS all_time_margin_pct
  FROM base b
  LEFT JOIN period_labor pl ON pl.project_id = b.project_id
  LEFT JOIN period_material pm ON pm.project_id = b.project_id
  LEFT JOIN period_other po ON po.project_id = b.project_id
  LEFT JOIN all_labor al ON al.project_id = b.project_id
  LEFT JOIN all_material am ON am.project_id = b.project_id
  LEFT JOIN all_other ao ON ao.project_id = b.project_id
  ORDER BY b.project_name ASC;
$$;
