import { loadImage } from '@napi-rs/canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchImages } from '../src/fetchers/images-fetcher.js';

vi.mock('@napi-rs/canvas', () => ({
  loadImage: vi.fn()
}));

describe('fetchImages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads images using the requested size', async () => {
    const image = {
      width: 64,
      height: 64
    } as unknown as Awaited<ReturnType<typeof loadImage>>;

    vi.mocked(loadImage).mockResolvedValue(image);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchImages(
      ['https://avatars.githubusercontent.com/u/1?v=4'],
      96
    );

    expect(result).toEqual([image]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://avatars.githubusercontent.com/u/1?v=4&size=96',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(loadImage).toHaveBeenCalledOnce();
  });

  it('warns when an image cannot be downloaded after retries', async () => {
    const onWarning = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503
      })
    );

    const result = await fetchImages(
      ['https://avatars.githubusercontent.com/u/1'],
      64,
      { retries: 2, onWarning }
    );

    expect(result).toEqual([]);
    expect(loadImage).not.toHaveBeenCalled();
    expect(onWarning).toHaveBeenCalledWith({
      url: 'https://avatars.githubusercontent.com/u/1',
      error: new Error('Image request failed with status 503'),
      attempts: 3
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('downloads multiple images', async () => {
    const firstImage = {
      id: 1
    } as unknown as Awaited<ReturnType<typeof loadImage>>;

    const secondImage = {
      id: 2
    } as unknown as Awaited<ReturnType<typeof loadImage>>;

    vi.mocked(loadImage)
      .mockResolvedValueOnce(firstImage)
      .mockResolvedValueOnce(secondImage);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1]).buffer)
      })
    );

    const result = await fetchImages(
      [
        'https://avatars.githubusercontent.com/u/1',
        'https://avatars.githubusercontent.com/u/2'
      ],
      64
    );

    expect(result).toEqual([firstImage, secondImage]);
    expect(loadImage).toHaveBeenCalledTimes(2);
  });

  it('aborts timed out requests and retries them', async () => {
    const onWarning = vi.fn();
    const fetchMock = vi.fn().mockImplementation((_url, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted', 'AbortError'))
        );
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = fetchImages(
      ['https://avatars.githubusercontent.com/u/1'],
      64,
      { timeout: 1, retries: 1, onWarning }
    );

    await expect(resultPromise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://avatars.githubusercontent.com/u/1',
        attempts: 2
      })
    );
  });
});
