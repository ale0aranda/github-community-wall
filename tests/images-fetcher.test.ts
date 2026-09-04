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
      'https://avatars.githubusercontent.com/u/1?v=4&size=96'
    );
    expect(loadImage).toHaveBeenCalledOnce();
  });

  it('ignores images that cannot be downloaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false
      })
    );

    const result = await fetchImages(
      ['https://avatars.githubusercontent.com/u/1'],
      64
    );

    expect(result).toEqual([]);
    expect(loadImage).not.toHaveBeenCalled();
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
});
