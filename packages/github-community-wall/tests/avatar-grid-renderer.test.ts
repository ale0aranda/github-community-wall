import { createCanvas } from '@napi-rs/canvas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchImages } from '../src/fetchers/images-fetcher.js';
import {
  renderAvatarGrid,
  renderTwitterBanner,
  validateAvatarGridOptions
} from '../src/renderer/avatar-grid-renderer.js';

const canvasMocks = vi.hoisted(() => ({
  arc: vi.fn(),
  beginPath: vi.fn(),
  clip: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  toBuffer: vi.fn().mockReturnValue(Buffer.from('canvas'))
}));

vi.mock('@napi-rs/canvas', () => ({
  createCanvas: vi.fn(() => ({
    getContext: vi.fn(() => ({
      arc: canvasMocks.arc,
      beginPath: canvasMocks.beginPath,
      clip: canvasMocks.clip,
      drawImage: canvasMocks.drawImage,
      fillRect: canvasMocks.fillRect,
      fillText: canvasMocks.fillText,
      restore: canvasMocks.restore,
      save: canvasMocks.save
    })),
    toBuffer: canvasMocks.toBuffer
  }))
}));

vi.mock('../src/fetchers/images-fetcher.js', () => ({
  fetchImages: vi.fn()
}));

describe('validateAvatarGridOptions', () => {
  it('rejects a non-positive image size', () => {
    expect(() =>
      validateAvatarGridOptions({
        imageSize: 0,
        columns: 4
      })
    ).toThrow('Image size must be greater than zero');
  });

  it('rejects a non-positive column count', () => {
    expect(() =>
      validateAvatarGridOptions({
        imageSize: 64,
        columns: 0
      })
    ).toThrow('Columns must be greater than zero');
  });

  it('rejects a negative gap', () => {
    expect(() =>
      validateAvatarGridOptions({
        imageSize: 64,
        columns: 4,
        gap: -1
      })
    ).toThrow('Gap must not be negative');
  });

  it('accepts valid options', () => {
    expect(() =>
      validateAvatarGridOptions({
        imageSize: 64,
        columns: 4,
        gap: 8
      })
    ).not.toThrow();
  });

  describe('renderAvatarGrid', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('renders a square PNG grid', async () => {
      const images = [{ id: 1 }, { id: 2 }, { id: 3 }] as unknown as Awaited<
        ReturnType<typeof fetchImages>
      >;

      vi.mocked(fetchImages).mockResolvedValue(images);

      const result = await renderAvatarGrid(
        ['avatar-1', 'avatar-2', 'avatar-3'],
        {
          imageSize: 64,
          columns: 2,
          gap: 4,
          background: '#ffffff'
        }
      );

      expect(fetchImages).toHaveBeenCalledWith(
        ['avatar-1', 'avatar-2', 'avatar-3'],
        64
      );

      expect(createCanvas).toHaveBeenCalledWith(132, 132);

      expect(canvasMocks.fillRect).toHaveBeenCalledWith(0, 0, 132, 132);

      expect(canvasMocks.drawImage).toHaveBeenNthCalledWith(
        1,
        images[0],
        0,
        0,
        64,
        64
      );

      expect(canvasMocks.drawImage).toHaveBeenNthCalledWith(
        2,
        images[1],
        68,
        0,
        64,
        64
      );

      expect(canvasMocks.drawImage).toHaveBeenNthCalledWith(
        3,
        images[2],
        0,
        68,
        64,
        64
      );

      expect(canvasMocks.toBuffer).toHaveBeenCalledWith('image/png');
      expect(result).toEqual(Buffer.from('canvas'));
    });

    it('clips circular avatars', async () => {
      const image = { id: 1 } as unknown as Awaited<
        ReturnType<typeof fetchImages>
      >[number];

      vi.mocked(fetchImages).mockResolvedValue([image]);

      await renderAvatarGrid(['avatar-1'], {
        imageSize: 64,
        columns: 1,
        shape: 'circle'
      });

      expect(canvasMocks.save).toHaveBeenCalledOnce();
      expect(canvasMocks.beginPath).toHaveBeenCalledOnce();
      expect(canvasMocks.arc).toHaveBeenCalledWith(32, 32, 32, 0, Math.PI * 2);
      expect(canvasMocks.clip).toHaveBeenCalledOnce();
      expect(canvasMocks.drawImage).toHaveBeenCalledWith(image, 0, 0, 64, 64);
      expect(canvasMocks.restore).toHaveBeenCalledOnce();
    });

    it('renders WebP output', async () => {
      vi.mocked(fetchImages).mockResolvedValue([{ id: 1 }] as never);

      await renderAvatarGrid(['avatar-1'], {
        imageSize: 64,
        columns: 1,
        format: 'webp'
      });
      expect(canvasMocks.toBuffer).toHaveBeenCalledWith('image/webp');
    });

    it('renders JPEG output', async () => {
      vi.mocked(fetchImages).mockResolvedValue([{ id: 1 }] as never);

      await renderAvatarGrid(['avatar-1'], {
        imageSize: 64,
        columns: 1,
        format: 'jpeg'
      });

      expect(canvasMocks.toBuffer).toHaveBeenCalledWith('image/jpeg');
    });

    it('renders standalone HTML and JSON metadata without fetching images', async () => {
      const html = await renderAvatarGrid(['https://example.com/avatar.png'], {
        imageSize: 64,
        columns: 1,
        format: 'html',
        title: 'Community'
      });
      expect(html.toString()).toContain('<!doctype html>');
      expect(html.toString()).toContain('https://example.com/avatar.png');
      expect(fetchImages).not.toHaveBeenCalled();

      const metadata = await renderAvatarGrid(['avatar-1'], {
        imageSize: 64,
        columns: 1,
        format: 'json'
      });
      expect(JSON.parse(metadata.toString())).toMatchObject({
        count: 1,
        avatars: ['avatar-1']
      });
    });
  });

  it('renders an empty grid without drawing images', async () => {
    vi.mocked(fetchImages).mockResolvedValue([]);

    const result = await renderAvatarGrid([], {
      imageSize: 64,
      columns: 3
    });

    expect(createCanvas).toHaveBeenCalledWith(192, 64);
    expect(canvasMocks.drawImage).not.toHaveBeenCalled();
    expect(result).toEqual(Buffer.from('canvas'));
  });

  it('renders SVG with escaped content and circular clipping', async () => {
    vi.mocked(fetchImages).mockResolvedValue([{ id: 1 }, { id: 2 }] as never);

    const result = await renderAvatarGrid(
      ['https://example.com/a?<>&\'"', 'avatar-2'],
      {
        imageSize: 64,
        columns: 2,
        gap: 8,
        shape: 'circle',
        background: '<background>',
        title: 'Title <>&\'"',
        subtitle: 'Subtitle <>&\'"',
        format: 'svg'
      }
    );

    const svg = result.toString();

    expect(createCanvas).not.toHaveBeenCalled();
    expect(svg).toContain('width="136"');
    expect(svg).toContain('height="64"');
    expect(svg).toContain('fill="&lt;background&gt;"');
    expect(svg).toContain('Title &lt;&gt;&amp;&apos;&quot;');
    expect(svg).toContain('Subtitle &lt;&gt;&amp;&apos;&quot;');
    expect(svg).toContain('rx="50%"');
    expect(svg).toContain('clip-0');
    expect(svg).toContain('clip-1');
    expect(svg).toContain('https://example.com/a?&lt;&gt;&amp;&apos;&quot;');
  });

  it('uses square SVG clipping when no shape is provided', async () => {
    vi.mocked(fetchImages).mockResolvedValue([{ id: 1 }] as never);

    const result = await renderAvatarGrid(['avatar-1'], {
      imageSize: 64,
      columns: 1,
      format: 'svg'
    });

    expect(result.toString()).toContain('rx="0"');
  });
});

describe('renderTwitterBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a non-positive image size', async () => {
    await expect(
      renderTwitterBanner([], {
        imageSize: 0
      })
    ).rejects.toThrow('Image size must be greater than zero');

    expect(fetchImages).not.toHaveBeenCalled();
  });

  it('rejects a negative gap', async () => {
    await expect(
      renderTwitterBanner([], {
        imageSize: 64,
        gap: -1
      })
    ).rejects.toThrow('Gap must not be negative');

    expect(fetchImages).not.toHaveBeenCalled();
  });

  it('renders a multi-row circular PNG banner', async () => {
    const images = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 }
    ] as never;

    vi.mocked(fetchImages).mockResolvedValue(images);

    const result = await renderTwitterBanner(['1', '2', '3', '4', '5'], {
      imageSize: 64,
      gap: 8,
      shape: 'circle',
      background: '#123456'
    });

    expect(fetchImages).toHaveBeenCalledWith(['1', '2', '3', '4', '5'], 64);

    expect(createCanvas).toHaveBeenCalledWith(1500, 500);
    expect(canvasMocks.fillRect).toHaveBeenCalledWith(0, 0, 1500, 500);

    expect(canvasMocks.drawImage).toHaveBeenCalledTimes(5);
    expect(canvasMocks.beginPath).toHaveBeenCalledTimes(5);
    expect(canvasMocks.arc).toHaveBeenCalledTimes(5);
    expect(canvasMocks.clip).toHaveBeenCalledTimes(5);
    expect(canvasMocks.restore).toHaveBeenCalledTimes(5);

    expect(canvasMocks.toBuffer).toHaveBeenCalledWith('image/png');
    expect(result).toEqual(Buffer.from('canvas'));
  });

  it('renders an SVG banner', async () => {
    vi.mocked(fetchImages).mockResolvedValue([{ id: 1 }, { id: 2 }] as never);

    const result = await renderTwitterBanner(['avatar-1', 'avatar-2'], {
      imageSize: 64,
      format: 'svg',
      background: '#000000',
      shape: 'circle',
      gap: 4
    });

    const svg = result.toString();

    expect(createCanvas).toHaveBeenCalledWith(1500, 500);
    expect(svg).toContain('<svg');
    expect(svg).toContain('width="1500"');
    expect(svg).toContain('height="500"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('rx="50%"');
  });

  it('renders WebP output', async () => {
    vi.mocked(fetchImages).mockResolvedValue([{ id: 1 }] as never);

    await renderTwitterBanner(['avatar-1'], {
      imageSize: 64,
      format: 'webp'
    });

    expect(canvasMocks.toBuffer).toHaveBeenCalledWith('image/webp');
  });
});
