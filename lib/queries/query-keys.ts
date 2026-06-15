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
  vendors: {
    all: ["vendors"] as const,
    byType: (type: "supplier" | "subcontractor") =>
      [...queryKeys.vendors.all, "by-type", type] as const,
    activeSuppliersForPO: () =>
      [...queryKeys.vendors.all, "active-suppliers-po"] as const,
    activeSubcontractorOptions: () =>
      [...queryKeys.vendors.all, "active-subcontractor-options"] as const,
  },
};
