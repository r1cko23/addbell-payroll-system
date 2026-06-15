import type { VendorType } from "@/types/vendor";

export type VendorDirectoryConfig = {
  title: string;
  subtitle: string;
  addButtonLabel: string;
  dialogAddTitle: string;
  dialogEditTitle: string;
  dialogDescription: string;
  namePlaceholder: string;
  emptyState: string;
  loadError: string;
  saveError: string;
  deleteSuccess: string;
  createSuccess: string;
  updateSuccess: string;
  nameRequired: string;
};

export const VENDOR_DIRECTORY_CONFIG: Record<VendorType, VendorDirectoryConfig> = {
  supplier: {
    title: "Vendors",
    subtitle: "Manage suppliers for purchase orders.",
    addButtonLabel: "Add Vendor",
    dialogAddTitle: "Add Vendor",
    dialogEditTitle: "Edit Vendor",
    dialogDescription: "Vendor details will auto-fill when selected in Purchase Orders.",
    namePlaceholder: "Vendor or supplier name",
    emptyState: "No vendors found. Add one to use in Purchase Orders.",
    loadError: "Failed to load vendors",
    saveError: "Failed to save vendor",
    deleteSuccess: "Vendor deleted successfully",
    createSuccess: "Vendor created successfully",
    updateSuccess: "Vendor updated successfully",
    nameRequired: "Vendor name is required",
  },
  subcontractor: {
    title: "Subcontractors",
    subtitle: "Manage subcontractors for fund request payments.",
    addButtonLabel: "Add Subcontractor",
    dialogAddTitle: "Add Subcontractor",
    dialogEditTitle: "Edit Subcontractor",
    dialogDescription:
      "Subcontractor details will appear in fund request subcontractor payments.",
    namePlaceholder: "Subcontractor name",
    emptyState: "No subcontractors found. Add one to use in fund requests.",
    loadError: "Failed to load subcontractors",
    saveError: "Failed to save subcontractor",
    deleteSuccess: "Subcontractor deleted successfully",
    createSuccess: "Subcontractor created successfully",
    updateSuccess: "Subcontractor updated successfully",
    nameRequired: "Subcontractor name is required",
  },
};

export interface VendorRecord {
  id: string;
  company_id?: string | null;
  name: string;
  contact_person: string | null;
  tin: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  type: VendorType;
  is_active: boolean;
  created_at: string;
}
