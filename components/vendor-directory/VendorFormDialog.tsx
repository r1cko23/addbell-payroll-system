"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { bustCache } from "@/lib/cache-client";
import { formatTinWithDashes, TIN_PLACEHOLDER } from "@/lib/tin-format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { dbDialogContentWide, dbDialogFooter, dbHeaderButton } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import type { VendorType } from "@/types/vendor";
import {
  VENDOR_DIRECTORY_CONFIG,
  type VendorRecord,
} from "@/components/vendor-directory/vendor-directory-config";
import {
  formatPhilippinePhoneForInput,
  isAcceptableVendorPhoneEntry,
  normalizePhoneEntryForStorage,
  primaryStoredPhone,
} from "@/lib/philippine-phone";
import {
  isValidEmailAddress,
  partitionVendorContactDisplay,
} from "@/lib/vendor-contacts";

type VendorFormDialogProps = {
  vendorType: VendorType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord?: VendorRecord | null;
  onSaved?: (record: VendorRecord) => void | Promise<void>;
};

export function VendorFormDialog({
  vendorType,
  open,
  onOpenChange,
  editingRecord = null,
  onSaved,
}: VendorFormDialogProps) {
  const config = VENDOR_DIRECTORY_CONFIG[vendorType];
  const supabase = createClient();

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [tin, setTin] = useState("");
  const [address, setAddress] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [accountName, setAccountName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingRecord) {
      setName(editingRecord.name);
      setContactPerson(editingRecord.contact_person || "");
      setTin(formatTinWithDashes(editingRecord.tin || ""));
      setAddress(editingRecord.address || "");
      const { phones: existingPhones, emails: existingEmails } =
        partitionVendorContactDisplay(editingRecord);
      setPhones(existingPhones);
      setEmails(existingEmails);
      setAccountName(editingRecord.account_name?.trim() ?? "");
      setIsActive(editingRecord.is_active);
      return;
    }
    setName("");
    setContactPerson("");
    setTin("");
    setAddress("");
    setPhones([]);
    setEmails([]);
    setAccountName("");
    setIsActive(true);
  }, [editingRecord, open]);

  const addPhone = () => setPhones((current) => [...current, ""]);
  const updatePhone = (index: number, value: string) => {
    setPhones((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? formatPhilippinePhoneForInput(value) : entry
      )
    );
  };
  const handlePhonePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    if (pasted) updatePhone(index, pasted);
  };
  const removePhone = (index: number) => {
    setPhones((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  const addEmail = () => setEmails((current) => [...current, ""]);
  const updateEmail = (index: number, value: string) => {
    setEmails((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? value : entry
      )
    );
  };
  const removeEmail = (index: number) => {
    setEmails((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  const handleClose = () => onOpenChange(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      toast.error(config.nameRequired);
      return;
    }
    if (!contactPerson.trim()) {
      toast.error("Contact person is required.");
      return;
    }
    if (!tin.trim()) {
      toast.error("TIN is required.");
      return;
    }
    if (!address.trim()) {
      toast.error("Business address is required.");
      return;
    }
    const normalizedPhones = phones
      .map((entry) => normalizePhoneEntryForStorage(entry))
      .filter(Boolean);
    const invalidPhone = normalizedPhones.find(
      (entry) => !isAcceptableVendorPhoneEntry(entry)
    );
    if (invalidPhone) {
      toast.error(
        "Each phone must be a valid Philippine mobile, landline, or international (+...) number."
      );
      return;
    }
    const normalizedEmails = emails
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    const invalidEmail = normalizedEmails.find((entry) => !isValidEmailAddress(entry));
    if (invalidEmail) {
      toast.error("Enter a valid email address or remove the invalid email.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        contact_person: contactPerson.trim(),
        tin: formatTinWithDashes(tin),
        address: address.trim(),
        phones: normalizedPhones,
        emails: normalizedEmails,
        phone: primaryStoredPhone(normalizedPhones[0] ?? ""),
        email: normalizedEmails[0] ?? "",
        ...(vendorType === "subcontractor"
          ? { account_name: accountName.trim() || null }
          : {}),
        type: vendorType,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      let saved: VendorRecord | null = null;
      if (editingRecord) {
        const { data, error } = await supabase
          .from("vendors")
          .update(payload)
          .eq("id", editingRecord.id)
          .select("*")
          .single();

        if (error) throw error;
        saved = data as VendorRecord;
        toast.success(config.updateSuccess);
      } else {
        const { data, error } = await supabase
          .from("vendors")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;
        saved = data as VendorRecord;
        toast.success(config.createSuccess);
      }

      handleClose();
      await bustCache();
      if (saved) await onSaved?.(saved);
    } catch (error: unknown) {
      const message = (error as Error).message || config.saveError;
      if (message.includes("account_name")) {
        toast.error(
          "Account name column is missing. Run the vendors account_name migration in Supabase, then try again."
        );
      } else {
        toast.error(message);
      }
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dbDialogContentWide}>
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? config.dialogEditTitle : config.dialogAddTitle}
          </DialogTitle>
          <DialogDescription>
            {editingRecord
              ? config.dialogEditDescription
              : config.dialogAddDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="vendor-form-name">{config.nameLabel} *</Label>
            <Input
              id="vendor-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={config.namePlaceholder}
              required
            />
          </div>
          <div>
            <Label htmlFor="vendor-form-address">Business Address *</Label>
            <Textarea
              id="vendor-form-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, Barangay, City, Province"
              rows={2}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vendor-form-tin">TIN *</Label>
              <Input
                id="vendor-form-tin"
                value={tin}
                onChange={(e) => setTin(formatTinWithDashes(e.target.value))}
                placeholder={TIN_PLACEHOLDER}
                inputMode="numeric"
                autoComplete="off"
                required
              />
            </div>
            <div>
              <Label htmlFor="vendor-form-contact">Contact Person *</Label>
              <Input
                id="vendor-form-contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Primary contact person"
                required
              />
            </div>
          </div>
          {vendorType === "subcontractor" ? (
            <div>
              <Label htmlFor="vendor-form-account-name">Account Name</Label>
              <Input
                id="vendor-form-account-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Bank account name for payments"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Phone</Label>
              {phones.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {phones.map((entry, index) => (
                    <div key={`phone-${index}`} className="flex gap-2">
                      <Input
                        value={entry}
                        onChange={(e) => updatePhone(index, e.target.value)}
                        onPaste={(e) => handlePhonePaste(index, e)}
                        placeholder="09XXXXXXXXX or 02XXXXXXXX"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removePhone(index)}
                        aria-label="Remove phone"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No phone added yet.</p>
              )}
              <Button
                type="button"
                variant="outline"
                className={cn(dbHeaderButton, "mt-2")}
                onClick={addPhone}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add phone
              </Button>
            </div>
            <div>
              <Label>Email</Label>
              {emails.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {emails.map((entry, index) => (
                    <div key={`email-${index}`} className="flex gap-2">
                      <Input
                        type="email"
                        value={entry}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder="vendor@example.com"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeEmail(index)}
                        aria-label="Remove email"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No email added yet.</p>
              )}
              <Button
                type="button"
                variant="outline"
                className={cn(dbHeaderButton, "mt-2")}
                onClick={addEmail}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add email
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="vendor-form-status"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="vendor-form-status" className="font-normal">
              Active
            </Label>
          </div>
          <DialogFooter className={dbDialogFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingRecord ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
