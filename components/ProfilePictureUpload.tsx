"use client";

import { useState, useRef, useEffect } from "react";
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

      const form = new FormData();
      form.append("as", userType);
      form.append("file", fileToUpload);
      const res = await fetch("/api/profile-picture", { method: "POST", body: form });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !payload.url) {
        throw new Error(payload.error || "Failed to upload profile picture");
      }
      const publicUrl = payload.url;
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
      const res = await fetch(`/api/profile-picture?as=${userType}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to remove profile picture");
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