import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type CliDependencies, createCli } from '../src/cli.js';

const createDependencies = (): CliDependencies => ({
  createHeaders: vi.fn().mockReturnValue({
    Authorization: 'Bearer test-token'
  }),
  fetchUsername: vi.fn().mockResolvedValue('authenticated-user'),
  generateFollowersGraph: vi.fn().mockResolvedValue(Buffer.from('image')),
  makeDirectory: vi.fn().mockResolvedValue(undefined),
  saveFile: vi.fn().mockResolvedValue(undefined),
  writeOutput: vi.fn()
});

describe('GitHub Community Wall CLI', () => {
  beforeEach(() => {
    delete process.env['GITHUB_TOKEN'];
  });

  it('generates a followers wall', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(
      [
        'followers',
        'ale0aranda',
        '--github-token',
        'test-token',
        '--output',
        'graphs/followers.png',
        '--image-size',
        '80',
        '--columns',
        '5',
        '--limit',
        '50'
      ],
      {
        from: 'user'
      }
    );

    expect(dependencies.createHeaders).toHaveBeenCalledWith('test-token');

    expect(dependencies.generateFollowersGraph).toHaveBeenCalledWith(
      'ale0aranda',
      80,
      5,
      {
        Authorization: 'Bearer test-token'
      },
      50
    );

    expect(dependencies.makeDirectory).toHaveBeenCalledWith(resolve('graphs'));

    expect(dependencies.saveFile).toHaveBeenCalledWith(
      resolve('graphs/followers.png'),
      Buffer.from('image')
    );
  });

  it('uses the authenticated user by default', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(['followers', '--github-token', 'test-token'], {
      from: 'user'
    });

    expect(dependencies.fetchUsername).toHaveBeenCalledOnce();

    expect(dependencies.generateFollowersGraph).toHaveBeenCalledWith(
      'authenticated-user',
      64,
      10,
      {
        Authorization: 'Bearer test-token'
      },
      100
    );
  });

  it('rejects a missing GitHub token', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await expect(
      cli.parseAsync(['followers', 'ale0aranda'], {
        from: 'user'
      })
    ).rejects.toThrow('Missing GitHub token');

    expect(dependencies.generateFollowersGraph).not.toHaveBeenCalled();
  });

  it('rejects invalid numeric options', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    const followersCommand = cli.commands.find(
      (command) => command.name() === 'followers'
    );

    expect(followersCommand).toBeDefined();

    followersCommand?.exitOverride();
    followersCommand?.configureOutput({
      writeErr: vi.fn()
    });

    await expect(
      cli.parseAsync(
        [
          'followers',
          'ale0aranda',
          '--github-token',
          'test-token',
          '--columns',
          '0'
        ],
        {
          from: 'user'
        }
      )
    ).rejects.toThrow('The value must be a positive integer');

    expect(dependencies.generateFollowersGraph).not.toHaveBeenCalled();
  });
});
