import type { Story, StoryImage } from "./types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not read image"));
    img.src = src;
  });
}

function toJpeg(img: HTMLImageElement, max: number, quality: number) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { url: canvas.toDataURL("image/jpeg", quality), w, h };
}

/** True when the picture has transparent pixels (a cut-out with the background removed). */
function hasTransparency(img: HTMLImageElement): boolean {
  const k = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return true;
  return false;
}

function toPng(img: HTMLImageElement, max: number) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return { url: canvas.toDataURL("image/png"), w, h };
}

/** Read an uploaded photo, downscale to max 1600px (keeps projects small), return a StoryImage. */
export async function fileToStoryImage(file: File): Promise<StoryImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    // a PNG with a transparent background is a cut-out: keep the alpha (a JPEG would fill it white)
    if (file.type === "image/png" && hasTransparency(img)) {
      const { url, w, h } = toPng(img, 1400);
      return { id: crypto.randomUUID(), src: url, width: w, height: h, caption: "", focalX: 0.5, focalY: 0.4, cutout: true };
    }
    const { url, w, h } = toJpeg(img, 1600, 0.86);
    return { id: crypto.randomUUID(), src: url, width: w, height: h, caption: "", focalX: 0.5, focalY: 0.4 };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Small JPEG used only for the AI request. */
export async function thumbnail(dataUrl: string, max = 640): Promise<string> {
  const img = await loadImage(dataUrl);
  return toJpeg(img, max, 0.72).url;
}

/** Turn photos that are served from a URL (the bundled sample) into data URLs, so a saved or exported project is self-contained. */
export async function inlineImages(stories: Story[]): Promise<Story[]> {
  const toData = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("could not read image"));
      r.readAsDataURL(blob);
    });
  return Promise.all(
    stories.map(async (s) => ({
      ...s,
      images: await Promise.all(s.images.map(async (i) => (i.src.startsWith("data:") ? i : { ...i, src: await toData(await (await fetch(i.src)).blob()) }))),
    })),
  );
}
