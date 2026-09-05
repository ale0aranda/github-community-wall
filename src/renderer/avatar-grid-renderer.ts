import { createCanvas } from '@napi-rs/canvas';

import { fetchImages } from '../fetchers/images-fetcher.js';

export interface AvatarGridOptions {
  columns: number;
  imageSize: number;
}

export const validateAvatarGridOptions = (options: AvatarGridOptions): void => {
  if (options.imageSize <= 0) {
    throw new RangeError('Image size must be greater than zero');
  }

  if (options.columns <= 0) {
    throw new RangeError('Columns must be greater than zero');
  }
};

export const renderAvatarGrid = async (
  avatarUrls: string[],
  options: AvatarGridOptions
): Promise<Buffer> => {
  validateAvatarGridOptions(options);

  const { columns, imageSize } = options;

  const images = await fetchImages(avatarUrls, imageSize);

  const width = imageSize * columns;
  const rowCount = Math.max(1, Math.ceil(images.length / columns));
  const height = rowCount * imageSize;

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  images.forEach((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    context.drawImage(
      image,
      column * imageSize,
      row * imageSize,
      imageSize,
      imageSize
    );
  });

  return canvas.toBuffer('image/png');
};
