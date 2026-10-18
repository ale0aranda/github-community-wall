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

  it('generates a sponsors wall', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(
      [
        'sponsors',
        'ale0aranda',
        '--github-token',
        'test-token',
        '--output',
        'assets/sponsors.png',
        '--image-size',
        '80',
        '--columns',
        '5',
        '--limit',
        '25'
      ],
      {
        from: 'user'
      }
    );

    expect(dependencies.generateSponsorsGraph).toHaveBeenCalledWith(
      'ale0aranda',
      80,
      5,
      {
        Authorization: 'Bearer test-token'
      },
      25
    );

    expect(dependencies.saveFile).toHaveBeenCalledWith(
      resolve('assets/sponsors.png'),
      Buffer.from('image')
    );

    expect(dependencies.writeOutput).toHaveBeenCalledWith(
      'Community wall generated for @ale0aranda\n'
    );
  });

  it('uses the authenticated user for sponsors by default', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(['sponsors', '--github-token', 'test-token'], {
      from: 'user'
    });

    expect(dependencies.fetchUsername).toHaveBeenCalledOnce();

    expect(dependencies.generateSponsorsGraph).toHaveBeenCalledWith(
      'authenticated-user',
      64,
      10,
      {
        Authorization: 'Bearer test-token'
      },
      100
    );
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

  it('generates a Twitter banner when requested', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(
      [
        'followers',
        'ale0aranda',
        '--github-token',
        'test-token',
        '--twitter-banner'
      ],
      {
        from: 'user'
      }
    );

    const generateFollowersGraph = vi.mocked(
      dependencies.generateFollowersGraph
    );

    expect(generateFollowersGraph).toHaveBeenCalledTimes(1);
    const call = generateFollowersGraph.mock.calls[0];

    expect(call?.[0]).toBe('ale0aranda');
    expect(call?.[1]).toBe(64);
    expect(call?.[2]).toBe(10);
    expect(call?.[4]).toBe(100);
    expect(call?.[5]).toBe(true);
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

  it('accepts advanced user filters', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(
      [
        'followers',
        'ale0aranda',
        '--github-token',
        'test-token',
        '--filter-type',
        'user',
        '--include-login',
        '^ale',
        '--exclude-login',
        'bot$'
      ],
      {
        from: 'user'
      }
    );

    const generateFollowersGraph = vi.mocked(
      dependencies.generateFollowersGraph
    );

    expect(generateFollowersGraph).toHaveBeenCalledTimes(1);
    const call = generateFollowersGraph.mock.calls[0];

    expect(call?.[0]).toBe('ale0aranda');
    expect(call?.[1]).toBe(64);
    expect(call?.[2]).toBe(10);
    expect(call?.[3]).toBeDefined();
    expect(call?.[4]).toBe(100);
    expect(call?.[5]).toBe(false);
    expect(call?.[6]).toMatchObject({
      filterType: 'user',
      includeLoginPattern: '^ale',
      excludeLoginPattern: 'bot$'
    });
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

  it('supports quiet output and config init', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(['config', 'init', 'tmp/community-wall.json'], {
      from: 'user'
    });

    expect(dependencies.makeDirectory).toHaveBeenCalledWith(resolve('tmp'));
    expect(dependencies.saveFile).toHaveBeenCalledWith(
      resolve('tmp/community-wall.json'),
      expect.any(Buffer)
    );

    await cli.parseAsync(
      ['sponsors', 'ale0aranda', '--github-token', 'test-token', '--quiet'],
      { from: 'user' }
    );

    expect(dependencies.writeOutput).not.toHaveBeenCalledWith(
      'Community wall generated for @ale0aranda\n'
    );
  });

  it('runs doctor checks without exposing the token', async () => {
    const dependencies = createDependencies();
    const cli = createCli(dependencies);

    await cli.parseAsync(['doctor', '--github-token', 'test-token', '--json'], {
      from: 'user'
    });

    expect(dependencies.createHeaders).toHaveBeenCalledWith('test-token');
    expect(dependencies.fetchUsername).toHaveBeenCalledOnce();
    expect(dependencies.writeOutput).toHaveBeenCalledWith(
      '{"ok":true,"checks":{"config":"ok","token":"ok","username":"ok"}}\n'
    );
  });
});
