export const queryKeys = {
  clients: {
    all: ["clients"] as const,
    list: () => [...queryKeys.clients.all, "list"] as const,
    activeOptions: () => [...queryKeys.clients.all, "active-options"] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: () => [...queryKeys.projects.all, "list"] as const,
    poPicker: () => [...queryKeys.projects.all, "po-picker"] as const,
  },
  poMasterlistJobs: {
    all: ["po-masterlist-jobs"] as const,
    list: (filters: {
      q?: string;
      project_statuses?: string[];
      payment_statuses?: string[];
      clients?: string[];
      years?: string[];
      page?: number;
      pageSize?: number;
    }) => [...queryKeys.poMasterlistJobs.all, "list", filters] as const,
    poLookup: () => [...queryKeys.poMasterlistJobs.all, "po-lookup"] as const,
  },
  vendors: {
    all: ["vendors"] as const,
    byType: (type: "supplier" | "subcontractor") =>
      [...queryKeys.vendors.all, "by-type", type] as const,
    activeSuppliersForPO: () =>
      [...queryKeys.vendors.all, "active-suppliers-po", "v2"] as const,
    activeSubcontractorOptions: () =>
      [...queryKeys.vendors.all, "active-subcontractor-options"] as const,
  },
};
