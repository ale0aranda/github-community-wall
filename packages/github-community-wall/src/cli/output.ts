import { dirname, relative, resolve } from 'node:path';

import type { CliDependencies } from './cli.js';
import type { WallOptions } from './options.js';

export const relativePath = (fromFile: string, targetFile: string): string =>
  relative(dirname(fromFile), targetFile).replaceAll('\\', '/');

export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const saveGraph = async (
  graph: Buffer,
  output: string,
  dependencies: CliDependencies
): Promise<string> => {
  const outputPath = resolve(output);

  await dependencies.makeDirectory(dirname(outputPath));

  await dependencies.saveFile(outputPath, graph);

  return outputPath;
};

export const writeResult = (
  subject: string,
  outputPath: string,
  dependencies: CliDependencies
): void => {
  dependencies.writeOutput(`Community wall generated for ${subject}\n`);

  dependencies.writeOutput(`Saved to: ${outputPath}\n`);
};

export const writeVerbose = (
  options: WallOptions,
  dependencies: CliDependencies
): void => {
  if (!options.verbose || options.quiet) {
    return;
  }

  dependencies.writeOutput(
    `Options: ${JSON.stringify(
      {
        columns: options.columns,
        imageSize: options.imageSize,
        limit: options.limit,
        output: options.output,
        format: options.format,
        sort: options.sort,
        excludeBots: options.excludeBots
      },
      null,
      2
    )}\n`
  );
};

export const writeSuccessResult = (
  subject: string,
  outputPath: string,
  options: WallOptions,
  dependencies: CliDependencies
): void => {
  if (!options.quiet) {
    writeResult(subject, outputPath, dependencies);
  }
};
