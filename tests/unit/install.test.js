const { getDockerSocketPath } = require('../../install');

describe('Installation helper: docker socket path', () => {
  afterEach(() => {
    delete process.env.DOCKER_SOCKET;
  });

  it('returns default socket path when DOCKER_SOCKET is not set', () => {
    expect(getDockerSocketPath()).toBe('/var/run/docker.sock');
  });

  it('respects DOCKER_SOCKET environment variable', () => {
    process.env.DOCKER_SOCKET = '/tmp/docker.sock';
    expect(getDockerSocketPath()).toBe('/tmp/docker.sock');
  });
});
