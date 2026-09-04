import { createCanvas } from '@napi-rs/canvas';

import { headers } from '../index.js';
import { fetchImages } from './images-fetcher.js';

import type { FollowersData } from '../types/globals.js';

interface GitHubGraphQLResponse {
  data: FollowersData;
}

export const fetchGraphQL = async (
  username: string
): Promise<FollowersData> => {
  const query = `
    {
      user(login: ${JSON.stringify(username)}) {
        followers(first: 100, after: null) {
          pageInfo {
            hasNextPage
          }
          nodes {
            avatarUrl
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    headers,
    method: 'POST',
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch data from GitHub: ${response.statusText}`);
  }

  const json = (await response.json()) as GitHubGraphQLResponse;

  return json.data;
};

export const fetchFollowersPfps = async (
  username: string,
  avatarsURLs: string[] = [],
  limit = 100
): Promise<string[]> => {
  const followersData = await fetchGraphQL(username);
  const { pageInfo, nodes } = followersData.user.followers;

  const updatedAvatarUrls = avatarsURLs.concat(
    nodes.map((node) => node.avatarUrl)
  );

  if (updatedAvatarUrls.length >= limit) {
    return updatedAvatarUrls.slice(0, limit);
  }

  if (!pageInfo.hasNextPage) {
    return updatedAvatarUrls;
  }

  return fetchFollowersPfps(username, updatedAvatarUrls, limit);
};

export const generateGraph = async (
  username: string,
  imageSize: number,
  rowsOfImages: number
): Promise<Buffer> => {
  const avatarUrls = await fetchFollowersPfps(username);
  const images = await fetchImages(avatarUrls, imageSize);

  const width = imageSize * rowsOfImages;
  const height = Math.ceil(images.length / rowsOfImages) * imageSize;

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  images.forEach((image, index) => {
    const column = index % rowsOfImages;
    const row = Math.floor(index / rowsOfImages);

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
