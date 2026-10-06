const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxOriginalBytes = 25_000_000;
const maxRequestBytes = 3_800_000;

export function validateAttachments(files: File[]): void {
  if (
    files.length > 3 ||
    files.some(
      (file) => file.size > maxOriginalBytes || !acceptedTypes.has(file.type),
    )
  )
    throw new Error(
      "Attach up to three JPEG, PNG, or WebP images, up to 25 MB each.",
    );
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function optimizeImage(file: File, budget: number): Promise<string> {
  if (file.size <= budget) return readImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare large images.");
    const initialScale = Math.min(
      1,
      2600 / Math.max(bitmap.width, bitmap.height),
    );
    for (let scale = initialScale; scale >= 0.2; scale *= 0.78) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.78, 0.66, 0.54, 0.42]) {
        let data = canvas.toDataURL("image/webp", quality);
        if (!data.startsWith("data:image/webp;"))
          data = canvas.toDataURL("image/jpeg", quality);
        if ((data.length - data.indexOf(",") - 1) * 0.75 <= budget) return data;
      }
    }
    throw new Error(
      "Could not fit this image into an AI request. Try a smaller image.",
    );
  } finally {
    bitmap.close();
  }
}

export async function ideaPayload(
  idea: string,
  guidance: Record<string, string>,
  files: File[],
  clarifications?: { question: string; answer: string }[],
): Promise<string> {
  validateAttachments(files);
  const base = {
    idea,
    guidance,
    ...(clarifications ? { clarifications } : {}),
  };
  const overhead = new Blob([JSON.stringify(base)]).size;
  if (overhead >= maxRequestBytes - 1000)
    throw new Error(
      "This idea has more text than the request can send at once.",
    );
  if (!files.length) return JSON.stringify(base);
  const budget = Math.min(
    2_500_000,
    Math.floor((maxRequestBytes - overhead - 1000) * 0.7),
  );
  if (budget / files.length < 10_000)
    throw new Error("There is not enough room to send images with this text.");
  const images = await Promise.all(
    files.map((file) => optimizeImage(file, Math.floor(budget / files.length))),
  );
  const body = JSON.stringify({ ...base, images });
  if (new Blob([body]).size > maxRequestBytes)
    throw new Error(
      "The images could not fit in this request. Remove one and try again.",
    );
  return body;
}
