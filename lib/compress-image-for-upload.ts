const DEFAULT_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;

export type CompressImageForUploadOptions = {
  maxDimension?: number;
  maxSizeKB?: number;
  initialQuality?: number;
  minQuality?: number;
  qualityStep?: number;
};

const DEFAULT_OPTIONS: Required<CompressImageForUploadOptions> = {
  maxDimension: 1800,
  maxSizeKB: 400,
  initialQuality: 0.82,
  minQuality: 0.5,
  qualityStep: 0.08,
};

export function isCompressibleImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return DEFAULT_IMAGE_EXTENSIONS.test(file.name);
}

function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  if (width >= height) {
    return {
      width: maxDimension,
      height: Math.round((height * maxDimension) / width),
    };
  }

  return {
    width: Math.round((width * maxDimension) / height),
    height: maxDimension,
  };
}

function replaceExtensionWithJpg(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  return `${base || "image"}.jpg`;
}

export function compressImageForUpload(
  file: File,
  options?: CompressImageForUploadOptions
): Promise<File> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  if (!isCompressibleImageFile(file)) {
    return Promise.resolve(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const { width, height } = scaledDimensions(
          img.width,
          img.height,
          config.maxDimension
        );

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not prepare image for upload"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const attemptCompress = (quality: number): void => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"));
                return;
              }

              const sizeKB = blob.size / 1024;
              if (sizeKB <= config.maxSizeKB || quality <= config.minQuality) {
                resolve(
                  new File([blob], replaceExtensionWithJpg(file.name), {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  })
                );
                return;
              }

              attemptCompress(Math.max(config.minQuality, quality - config.qualityStep));
            },
            "image/jpeg",
            quality
          );
        };

        attemptCompress(config.initialQuality);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
  });
}
