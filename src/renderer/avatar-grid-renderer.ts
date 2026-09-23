import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { fetchImages } from '../fetchers/images-fetcher.js';

export type UserFilterType = 'all' | 'user' | 'organization' | 'bot';

export interface AvatarGridOptions {
  columns: number;
  imageSize: number;
  background?: string | undefined;
  gap?: number | undefined;
  shape?: 'square' | 'circle' | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  format?: 'png' | 'jpeg' | 'webp' | 'svg' | 'html' | 'json' | undefined;
  excludeBots?: boolean | undefined;
  sort?: 'login' | 'contributions' | 'none' | undefined;
  theme?: 'github-dark' | 'github-light' | 'neon' | 'minimal' | undefined;
  watermark?: string | undefined;
  filterType?: UserFilterType | undefined;
  includeLoginPattern?: string | undefined;
  excludeLoginPattern?: string | undefined;
}

export interface TwitterBannerOptions {
  imageSize: number;
  background?: string | undefined;
  gap?: number | undefined;
  shape?: 'square' | 'circle' | undefined;
  format?: 'png' | 'jpeg' | 'webp' | 'svg' | undefined;
  theme?: AvatarGridOptions['theme'];
  watermark?: string | undefined;
}

export const validateAvatarGridOptions = (options: AvatarGridOptions): void => {
  if (options.imageSize <= 0) {
    throw new RangeError('Image size must be greater than zero');
  }

  if (options.columns <= 0) {
    throw new RangeError('Columns must be greater than zero');
  }

  if ((options.gap ?? 0) < 0) {
    throw new RangeError('Gap must not be negative');
  }
};

const escapeXml = (value: string): string =>
  value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;'
      })[character] ?? character
  );

const getTheme = (
  theme: AvatarGridOptions['theme']
): { background: string; foreground: string } =>
  ({
    'github-light': { background: '#f6f8fa', foreground: '#24292f' },
    neon: { background: '#090014', foreground: '#f0abfc' },
    minimal: { background: '#ffffff', foreground: '#111827' },
    'github-dark': { background: '#0d1117', foreground: '#f0f6fc' },
    undefined: { background: 'transparent', foreground: '#ffffff' }
  })[theme ?? 'undefined'];

const renderSvg = (
  avatarUrls: string[],
  width: number,
  height: number,
  columns: number,
  cellWidth: number,
  cellHeight: number,
  options: Pick<
    AvatarGridOptions,
    | 'background'
    | 'gap'
    | 'shape'
    | 'title'
    | 'subtitle'
    | 'theme'
    | 'watermark'
  >
): Buffer => {
  const gap = options.gap ?? 0;
  const background = options.background ?? getTheme(options.theme).background;
  const radius = options.shape === 'circle' ? '50%' : '0';
  const cells = avatarUrls
    .map((url, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * cellWidth + gap / 2;
      const y = row * cellHeight + gap / 2;
      const imageWidth = Math.max(0, cellWidth - gap);
      const imageHeight = Math.max(0, cellHeight - gap);
      const clipId = `clip-${index}`;

      return `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${imageWidth}" height="${imageHeight}" rx="${radius}" /></clipPath><image href="${escapeXml(url)}" x="${x}" y="${y}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`;
    })
    .join('');

  const text = [
    options.title
      ? `<text x="${width / 2}" y="24" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18">${escapeXml(options.title)}</text>`
      : '',
    options.subtitle
      ? `<text x="${width / 2}" y="44" text-anchor="middle" fill="white" font-family="sans-serif" font-size="12">${escapeXml(options.subtitle)}</text>`
      : '',
    options.watermark
      ? `<text x="${width - 12}" y="${height - 10}" text-anchor="end" fill="${getTheme(options.theme).foreground}" opacity="0.7" font-family="sans-serif" font-size="11">${escapeXml(options.watermark)}</text>`
      : ''
  ].join('');

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${escapeXml(background)}" />${text}${cells}</svg>`
  );
};

const renderHtml = (
  avatarUrls: string[],
  options: Pick<
    AvatarGridOptions,
    | 'background'
    | 'gap'
    | 'shape'
    | 'title'
    | 'subtitle'
    | 'theme'
    | 'watermark'
  >
): Buffer => {
  const gap = options.gap ?? 0;
  const radius = options.shape === 'circle' ? '50%' : '0';
  const images = avatarUrls
    .map(
      (url) =>
        `<img src="${escapeXml(url)}" alt="" loading="lazy" style="width:64px;height:64px;object-fit:cover;border-radius:${radius};margin:${gap / 2}px">`
    )
    .join('');
  const title = options.title ? `<h1>${escapeXml(options.title)}</h1>` : '';
  const subtitle = options.subtitle
    ? `<p>${escapeXml(options.subtitle)}</p>`
    : '';
  return Buffer.from(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(options.title ?? 'Community wall')}</title><style>body{margin:0;padding:24px;background:${escapeXml(options.background ?? getTheme(options.theme).background)};font-family:system-ui,sans-serif;color:${getTheme(options.theme).foreground}}main{display:flex;flex-wrap:wrap;align-items:center;justify-content:center}h1,p{text-align:center}.watermark{text-align:right;opacity:.7;font-size:11px}</style></head><body>${title}${subtitle}<main>${images}</main>${options.watermark ? `<div class="watermark">${escapeXml(options.watermark)}</div>` : ''}</body></html>`
  );
};

const drawImage = (
  context: SKRSContext2D,
  image: Parameters<typeof context.drawImage>[0],
  x: number,
  y: number,
  width: number,
  height: number,
  shape: 'square' | 'circle'
): void => {
  context['save']();
  if (shape === 'circle') {
    context['beginPath']();
    context['arc'](
      x + width / 2,
      y + height / 2,
      Math.min(width, height) / 2,
      0,
      Math.PI * 2
    );
    context['clip']();
  }
  context.drawImage(image, x, y, width, height);
  context['restore']();
};

const toBuffer = (
  canvas: Canvas,
  format: AvatarGridOptions['format'] = 'png'
): Buffer =>
  format === 'webp'
    ? canvas.toBuffer('image/webp')
    : format === 'jpeg'
      ? canvas.toBuffer('image/jpeg')
      : canvas.toBuffer('image/png');

export const renderAvatarGrid = async (
  avatarUrls: string[],
  options: AvatarGridOptions
): Promise<Buffer> => {
  validateAvatarGridOptions(options);

  const { columns, imageSize } = options;
  const gap = options.gap ?? 0;
  const shape = options.shape ?? 'square';

  if (options.format === 'html') {
    return renderHtml(avatarUrls, options);
  }
  if (options.format === 'json') {
    return Buffer.from(
      `${JSON.stringify(
        {
          count: avatarUrls.length,
          avatars: avatarUrls,
          layout: { columns, imageSize, gap, shape }
        },
        null,
        2
      )}\n`
    );
  }

  const images = await fetchImages(avatarUrls, imageSize);
  const width = imageSize * columns + gap * Math.max(0, columns - 1);
  const rowCount = Math.max(1, Math.ceil(images.length / columns));
  const height = rowCount * imageSize + gap * Math.max(0, rowCount - 1);

  if (options.format === 'svg') {
    return renderSvg(
      avatarUrls.slice(0, images.length),
      width,
      height,
      columns,
      imageSize + gap,
      imageSize + gap,
      options
    );
  }

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context['fillStyle'] =
    options.background ?? getTheme(options.theme).background;
  context['fillRect'](0, 0, width, height);

  images.forEach((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawImage(
      context,
      image,
      column * (imageSize + gap),
      row * (imageSize + gap),
      imageSize,
      imageSize,
      shape
    );
  });

  return toBuffer(canvas, options.format);
};

export const renderTwitterBanner = async (
  avatarUrls: string[],
  options: TwitterBannerOptions
): Promise<Buffer> => {
  if (options.imageSize <= 0) {
    throw new RangeError('Image size must be greater than zero');
  }

  if ((options.gap ?? 0) < 0) {
    throw new RangeError('Gap must not be negative');
  }

  const images = await fetchImages(avatarUrls, options.imageSize);
  const width = 1500;
  const height = 500;
  const background =
    options.background
    ?? (options.theme ? getTheme(options.theme).background : '#0d1117');
  const shape = options.shape ?? 'square';
  const columns = Math.max(
    1,
    Math.ceil(Math.sqrt((images.length * width) / height))
  );
  const rows = Math.max(1, Math.ceil(images.length / columns));
  const gap = options.gap ?? 0;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context['fillStyle'] = background;
  context['fillRect'](0, 0, width, height);

  images.forEach((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const rowStart = row * columns;
    const imagesInRow = Math.min(columns, images.length - rowStart);
    const cellWidth = width / imagesInRow;
    const cellHeight = height / rows;
    drawImage(
      context,
      image,
      column * cellWidth + gap / 2,
      row * cellHeight + gap / 2,
      Math.max(0, cellWidth - gap),
      Math.max(0, cellHeight - gap),
      shape
    );
  });

  if (options.watermark) {
    context['fillStyle'] = getTheme(options.theme).foreground;
    context['font'] = '16px sans-serif';
    context['textAlign'] = 'right';
    context['fillText'](options.watermark, width - 16, height - 12);
  }

  if (options.format === 'svg') {
    return renderSvg(
      avatarUrls.slice(0, images.length),
      width,
      height,
      columns,
      width / columns,
      height / rows,
      options
    );
  }

  return toBuffer(canvas, options.format);
};
