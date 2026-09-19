import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { fetchImages } from '../fetchers/images-fetcher.js';

export interface AvatarGridOptions {
  columns: number;
  imageSize: number;
  background?: string | undefined;
  gap?: number | undefined;
  shape?: 'square' | 'circle' | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  format?: 'png' | 'webp' | 'svg' | undefined;
}

export interface TwitterBannerOptions {
  imageSize: number;
  background?: string | undefined;
  gap?: number | undefined;
  shape?: 'square' | 'circle' | undefined;
  format?: 'png' | 'webp' | 'svg' | undefined;
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

const renderSvg = (
  avatarUrls: string[],
  width: number,
  height: number,
  columns: number,
  cellWidth: number,
  cellHeight: number,
  options: Pick<
    AvatarGridOptions,
    'background' | 'gap' | 'shape' | 'title' | 'subtitle'
  >
): Buffer => {
  const gap = options.gap ?? 0;
  const background = options.background ?? 'transparent';
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
      : ''
  ].join('');

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${escapeXml(background)}" />${text}${cells}</svg>`
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
    : canvas.toBuffer('image/png');

export const renderAvatarGrid = async (
  avatarUrls: string[],
  options: AvatarGridOptions
): Promise<Buffer> => {
  validateAvatarGridOptions(options);

  const { columns, imageSize } = options;
  const gap = options.gap ?? 0;
  const shape = options.shape ?? 'square';
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
  context['fillStyle'] = options.background ?? 'transparent';
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
  const background = options.background ?? '#0d1117';
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
