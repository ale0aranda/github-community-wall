import { type Image, loadImage } from '@napi-rs/canvas';

export interface ImageFetchWarning {
  url: string;
  error: unknown;
  attempts: number;
}

export interface FetchImagesOptions {
  timeout?: number;
  retries?: number;
  onWarning?: (warning: ImageFetchWarning) => void;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 2;

export const fetchImages = async (
  urls: string[],
  IMAGE_SIZE: number,
  options: FetchImagesOptions = {}
): Promise<Image[]> => {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const warn =
    options.onWarning
    ?? ((warning: ImageFetchWarning) => {
      console.warn(
        `Unable to download image ${warning.url} after ${warning.attempts} attempt(s):`,
        warning.error
      );
    });

  const imagePromises = urls.map(async (urlString) => {
    let imageUrl: string;
    try {
      const url = new URL(urlString);
      url.searchParams.set('size', IMAGE_SIZE.toString());
      imageUrl = url.toString();
    } catch (error) {
      warn({ url: urlString, error, attempts: 1 });
      return null;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(imageUrl, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Image request failed with status ${res.status}`);
        }

        const buf = await res.arrayBuffer();
        return await loadImage(Buffer.from(buf));
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    warn({
      url: urlString,
      error: lastError,
      attempts: retries + 1
    });
    return null;
  });

  const images = await Promise.all(imagePromises);
  return images.filter((img): img is Image => img !== null);
};
