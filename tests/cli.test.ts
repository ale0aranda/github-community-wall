import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type CliDependencies, createCli } from '../src/cli.js';

const createDependencies = (): CliDependencies => ({
  createHeaders: vi.fn().mockReturnValue({
    Authorization: 'Bearer test-token'
  }),
  generateSponsorsGraph: vi.fn().mockResolvedValue(Buffer.from('image')),
  fetchUsername: vi.fn().mockResolvedValue('authenticated-user'),
  generateContributorsGraph: vi.fn().mockResolvedValue(Buffer.from('image')),
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
        'assets/followers.png',
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

    expect(dependencies.makeDirectory).toHaveBeenCalledWith(resolve('assets'));

    expect(dependencies.saveFile).toHaveBeenCalledWith(
      resolve('assets/followers.png'),
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

  it('generates a contributors wall', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(
      [
        'contributors',
        'ale0aranda/pyschool',
        '--github-token',
        'test-token',
        '--output',
        'assets/contributors.png',
        '--image-size',
        '80',
        '--columns',
        '5',
        '--limit',
        '50',
        '--include-bots'
      ],
      {
        from: 'user'
      }
    );

    expect(dependencies.createHeaders).toHaveBeenCalledWith('test-token');

    expect(dependencies.generateContributorsGraph).toHaveBeenCalledWith(
      'ale0aranda/pyschool',
      80,
      5,
      {
        Authorization: 'Bearer test-token'
      },
      50,
      true
    );

    expect(dependencies.makeDirectory).toHaveBeenCalledWith(resolve('assets'));

    expect(dependencies.saveFile).toHaveBeenCalledWith(
      resolve('assets/contributors.png'),
      Buffer.from('image')
    );

    expect(dependencies.writeOutput).toHaveBeenCalledWith(
      'Community wall generated for ale0aranda/pyschool\n'
    );
  });

  it('excludes bots from contributors by default', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(
      ['contributors', 'ale0aranda/pyschool', '--github-token', 'test-token'],
      {
        from: 'user'
      }
    );

    expect(dependencies.generateContributorsGraph).toHaveBeenCalledWith(
      'ale0aranda/pyschool',
      64,
      10,
      {
        Authorization: 'Bearer test-token'
      },
      100,
      false
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
