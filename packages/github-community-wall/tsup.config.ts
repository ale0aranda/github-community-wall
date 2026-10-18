import { defineTsupLibraryConfig } from '@ale0aranda/rules/tsup/library';

export default defineTsupLibraryConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/bin.ts'
  },
  tsconfig: 'tsconfig.json',
  target: 'es2022'
});
