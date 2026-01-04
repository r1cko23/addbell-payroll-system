"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Caption } from "@/components/ui/typography";

interface ProfilePictureUploadProps {
  currentPictureUrl: string | null;
  userId: string;
  userName: string;
  userType: "user" | "employee";
  onUploadComplete?: (url: string | null) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

export function ProfilePictureUpload({
  currentPictureUrl,
  userId,
  userName,
  userType,
  onUploadComplete,
  size = "md",
  className,
}: ProfilePictureUploadProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentPictureUrl
  );

  useEffect(() => {
    setPreviewUrl(currentPictureUrl);
  }, [currentPictureUrl]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const compressImage = (
    file: File,
    maxSizeKB: number = 100
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          let quality = 0.9;

          // Calculate dimensions to keep aspect ratio
          const maxDimension = 400; // Max width/height
          if (width > height) {
            if (width > maxDimension) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const compress = (q: number): void => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("Failed to compress image"));
                  return;
                }

                const sizeKB = blob.size / 1024;
                if (sizeKB <= maxSizeKB || q <= 0.1) {
                  const compressedFile = new File([blob], file.name, {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } else {
                  compress(q - 0.1);
                }
              },
              "image/jpeg",
              q
            );
          };

          compress(quality);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
    });
  };

  const uploadFile = async (file: File) => {
    // Validate userId exists
    if (!userId || userId.trim() === "") {
      toast.error("User ID is missing. Please refresh the page.");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    setUploading(true);
    try {
      // Ensure file is under 100KB
      const maxSizeBytes = 100 * 1024;
      let fileToUpload = file;

      if (file.size > maxSizeBytes) {
        // Compress if still too large
        fileToUpload = await compressImage(file, 100);
      }

      // Validate compressed file is still under limit
      if (fileToUpload.size > maxSizeBytes) {
        toast.error(
          "Image is too large even after compression. Please use a smaller image."
        );
        setUploading(false);
        return;
      }

      const fileExt = "jpg"; // Always use jpg after compression
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Delete old picture BEFORE uploading new one to prevent duplicates
      if (currentPictureUrl) {
        try {
          // Extract filename from URL - handle different URL formats
          let oldFileName: string | null = null;

          // Try to extract from full URL path
          if (currentPictureUrl.includes("profile-pictures")) {
            const urlParts = currentPictureUrl.split("/");
            const lastPart = urlParts[urlParts.length - 1];
            // Remove query parameters if present (e.g., ?t=timestamp)
            oldFileName = lastPart.split("?")[0];
          }

          // Also try to find all files for this user to clean up duplicates
          if (userId && oldFileName) {
            // Delete the specific old file
            const { error: deleteError } = await supabase.storage
              .from("profile-pictures")
              .remove([oldFileName]);

            if (deleteError) {
              console.warn("Failed to delete old file:", deleteError);
            } else {
              console.log(
                "Successfully deleted old profile picture:",
                oldFileName
              );
            }

            // Also try to find and delete any other files for this user (cleanup duplicates)
            try {
              const { data: allFiles, error: listError } =
                await supabase.storage.from("profile-pictures").list("", {
                  limit: 1000,
                  sortBy: { column: "created_at", order: "desc" },
                });

              if (!listError && allFiles) {
                // Find all files that start with this userId
                const userFiles = allFiles.filter(
                  (file) =>
                    file.name.startsWith(`${userId}-`) && file.name !== fileName
                );

                if (userFiles.length > 0) {
                  const filesToDelete = userFiles.map((f) => f.name);
                  const { error: bulkDeleteError } = await supabase.storage
                    .from("profile-pictures")
                    .remove(filesToDelete);

                  if (!bulkDeleteError) {
                    console.log(
                      `Cleaned up ${filesToDelete.length} old profile picture(s) for user ${userId}`
                    );
                  }
                }
              }
            } catch (cleanupErr) {
              console.warn("Could not cleanup duplicate files:", cleanupErr);
            }
          }
        } catch (err) {
          console.warn("Error deleting old profile picture:", err);
          // Continue with upload even if deletion fails
        }
      }

      // Upload new file
      // cacheControl: "31536000" = 1 year (profile pictures rarely change)
      // This maximizes CDN and browser caching while keeping costs low
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, fileToUpload, {
          cacheControl: "31536000", // 1 year - profile pictures rarely change
          upsert: false, // Don't overwrite - we want unique filenames
        });

      if (uploadError) {
        console.error("Storage upload error:", {
          error: uploadError,
          fileName,
          fileSize: fileToUpload.size,
          userId,
          bucket: "profile-pictures",
        });
        throw new Error(
          uploadError.message || "Failed to upload image to storage"
        );
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);

      // Update database
      // Use RPC functions for both users and employees to bypass RLS issues
      let updateError = null;
      console.log("Updating profile picture:", { userType, userId, publicUrl });

      if (userType === "user") {
        // Users use RPC function to avoid RLS policy issues
        console.log("Using RPC function for user");
        const { error, data } = await supabase.rpc(
          "update_user_profile_picture",
          {
            p_user_id: userId,
            p_profile_picture_url: publicUrl,
          } as any
        );
        console.log("RPC result (user):", { error, data });
        updateError = error;
      } else if (userType === "employee") {
        // Employees use RPC function (they don't have Supabase Auth)
        console.log("Using RPC function for employee");
        const { error, data } = await supabase.rpc(
          "update_employee_profile_picture",
          {
            p_employee_id: userId,
            p_profile_picture_url: publicUrl,
          } as any
        );
        console.log("RPC result (employee):", { error, data });
        updateError = error;
      } else {
        console.error("Unknown userType:", userType);
        throw new Error(`Unknown userType: ${userType}`);
      }

      if (updateError) {
        console.error("Database update error:", {
          error: updateError,
          userType,
          userId,
          publicUrl,
        });
        // Try to delete the uploaded file if database update fails
        try {
          await supabase.storage.from("profile-pictures").remove([filePath]);
        } catch (cleanupError) {
          console.warn("Failed to cleanup uploaded file:", cleanupError);
        }
        throw new Error(
          updateError.message || "Failed to update profile picture in database"
        );
      }

      setPreviewUrl(publicUrl);
      toast.success("Profile picture updated successfully");
      onUploadComplete?.(publicUrl);
    } catch (error: any) {
      console.error("Error uploading profile picture:", error);
      toast.error(error.message || "Failed to upload profile picture");
      setPreviewUrl(currentPictureUrl); // Revert preview
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate userId exists
    if (!userId || userId.trim() === "") {
      toast.error("User ID is missing. Please refresh the page.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 100KB - strict, but will compress if needed)
    const maxSizeBytes = 100 * 1024;
    if (file.size > maxSizeBytes * 10) {
      // If file is more than 1MB, reject immediately
      toast.error(
        "Image is too large. Please select a smaller image (max 100KB)"
      );
      return;
    }

    // Try to compress and upload
    try {
      await uploadFile(file);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to process image");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!currentPictureUrl) return;

    setUploading(true);
    try {
      // Delete from storage
      try {
        // Extract filename from URL - handle different URL formats
        let fileName: string | null = null;

        if (currentPictureUrl.includes("profile-pictures")) {
          const urlParts = currentPictureUrl.split("/");
          const lastPart = urlParts[urlParts.length - 1];
          // Remove query parameters if present
          fileName = lastPart.split("?")[0];
        }

        if (fileName) {
          const { error: deleteError } = await supabase.storage
            .from("profile-pictures")
            .remove([fileName]);

          if (deleteError) {
            console.warn(
              "Failed to delete profile picture from storage:",
              deleteError
            );
          } else {
            console.log("Successfully deleted profile picture:", fileName);
          }

          // Also cleanup any other files for this user
          if (userId) {
            try {
              const { data: allFiles, error: listError } =
                await supabase.storage.from("profile-pictures").list("", {
                  limit: 1000,
                  sortBy: { column: "created_at", order: "desc" },
                });

              if (!listError && allFiles) {
                const userFiles = allFiles.filter((file) =>
                  file.name.startsWith(`${userId}-`)
                );

                if (userFiles.length > 0) {
                  const filesToDelete = userFiles.map((f) => f.name);
                  const { error: bulkDeleteError } = await supabase.storage
                    .from("profile-pictures")
                    .remove(filesToDelete);

                  if (!bulkDeleteError) {
                    console.log(
                      `Cleaned up ${filesToDelete.length} profile picture file(s) for user ${userId}`
                    );
                  }
                }
              }
            } catch (cleanupErr) {
              console.warn("Could not cleanup user files:", cleanupErr);
            }
          }
        }
      } catch (err) {
        console.warn("Could not delete profile picture from storage:", err);
      }

      // Update database
      // Use RPC functions for both users and employees to bypass RLS issues
      let updateError = null;
      console.log("Removing profile picture:", { userType, userId });

      if (userType === "user") {
        // Users use RPC function to avoid RLS policy issues
        console.log("Using RPC function for user (remove)");
        const { error, data } = await supabase.rpc(
          "update_user_profile_picture",
          {
            p_user_id: userId,
            p_profile_picture_url: null,
          } as any
        );
        console.log("RPC result (user remove):", { error, data });
        updateError = error;
      } else if (userType === "employee") {
        // Employees use RPC function (they don't have Supabase Auth)
        console.log("Using RPC function for employee (remove)");
        const { error, data } = await supabase.rpc(
          "update_employee_profile_picture",
          {
            p_employee_id: userId,
            p_profile_picture_url: null,
          } as any
        );
        console.log("RPC result (employee remove):", { error, data });
        updateError = error;
      } else {
        console.error("Unknown userType:", userType);
        throw new Error(`Unknown userType: ${userType}`);
      }

      if (updateError) {
        throw updateError;
      }

      setPreviewUrl(null);
      toast.success("Profile picture removed");
      onUploadComplete?.(null);
    } catch (error: any) {
      console.error("Error removing profile picture:", error);
      toast.error(error.message || "Failed to remove profile picture");
    } finally {
      setUploading(false);
    }
  };

  const isUserIdValid = userId && userId.trim() !== "";

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <Avatar className={cn(sizeMap[size], "border-2 border-border")}>
        <AvatarImage src={previewUrl || undefined} alt="Profile picture" />
        <AvatarFallback className="bg-muted text-muted-foreground text-lg">
          {getInitials(userName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!isUserIdValid) {
              toast.error("User ID is missing. Please refresh the page.");
              return;
            }
            fileInputRef.current?.click();
          }}
          disabled={uploading || !isUserIdValid}
        >
          <Icon name="Camera" size={IconSizes.sm} />
          {uploading ? "Uploading..." : "Change"}
        </Button>
        {previewUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={uploading || !isUserIdValid}
          >
            <Icon name="Trash" size={IconSizes.sm} />
            Remove
          </Button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={!isUserIdValid}
      />
      <Caption className="text-xs text-muted-foreground text-center max-w-xs">
        Maximum file size: 100KB. Images will be automatically compressed if
        needed.
      </Caption>
      {!isUserIdValid && (
        <Caption className="text-xs text-destructive text-center max-w-xs">
          Unable to upload: User ID is missing. Please refresh the page.
        </Caption>
      )}
    </div>
  );
}