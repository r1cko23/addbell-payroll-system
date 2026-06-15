import type { VendorType } from "@/types/vendor";

export type VendorDirectoryConfig = {
  title: string;
  subtitle: string;
  addButtonLabel: string;
  dialogAddTitle: string;
  dialogEditTitle: string;
  dialogAddDescription: string;
  dialogEditDescription: string;
  namePlaceholder: string;
  nameLabel: string;
  nameRequired: string;
  emptyState: string;
  loadError: string;
  saveError: string;
  deleteSuccess: string;
  createSuccess: string;
  updateSuccess: string;
};

export const VENDOR_DIRECTORY_CONFIG: Record<VendorType, VendorDirectoryConfig> = {
  supplier: {
    title: "Vendors",
    subtitle: "Manage suppliers and their information.",
    addButtonLabel: "Add Vendor",
    dialogAddTitle: "Add Vendor",
    dialogEditTitle: "Edit Vendor",
    dialogAddDescription: "Vendor details will auto-fill when selected in Purchase Orders.",
    dialogEditDescription: "",
    namePlaceholder: "Vendor name",
    nameLabel: "Registered Name",
    nameRequired: "Registered name is required",
    emptyState: "No vendors found. Add one to use in Purchase Orders.",
    loadError: "Failed to load vendors",
    saveError: "Failed to save vendor",
    deleteSuccess: "Vendor deleted successfully",
    createSuccess: "Vendor created successfully",
    updateSuccess: "Vendor updated successfully",
  },
  subcontractor: {
    title: "Subcontractors",
    subtitle: "Manage subcontractors and their information.",
    addButtonLabel: "Add Subcontractor",
    dialogAddTitle: "Add Subcontractor",
    dialogEditTitle: "Edit Subcontractor",
    dialogAddDescription: "Add a new subcontractor to the system.",
    dialogEditDescription: "",
    namePlaceholder: "Subcontractor name",
    nameLabel: "Registered Name",
    nameRequired: "Registered name is required",
    emptyState: "No subcontractors found. Add one to use in fund requests.",
    loadError: "Failed to load subcontractors",
    saveError: "Failed to save subcontractor",
    deleteSuccess: "Subcontractor deleted successfully",
    createSuccess: "Subcontractor created successfully",
    updateSuccess: "Subcontractor updated successfully",
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
  phones?: string[] | null;
  emails?: string[] | null;
  type: VendorType;
  is_active: boolean;
  created_at: string;
}
