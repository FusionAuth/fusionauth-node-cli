import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { action } from "../../src/commands/kickstart-kill.js"

/**
 * Fake child-process-like object returned by mocked spawn — supports the
 * minimal surface kickstart-kill's action() touches (.on, .stdout) without
 * running any real process.
 */
function fakeChildProcess() {
  return {
    on: () => {},
    stdout: undefined,
  }
}

describe('kickstart:kill action()', () => {
  test('does not call confirmOrExit or spawn when Docker is not installed', async () => {
    const confirmCalls = []
    const spawnCalls = []

    await action(
      { yes: false },
      {
        isDockerInstalled: () => false,
        confirmOrExit: async (...args) => { confirmCalls.push(args) },
        spawn: (...args) => { spawnCalls.push(args); return fakeChildProcess() },
      }
    )

    assert.equal(confirmCalls.length, 0, 'confirmOrExit should not be called')
    assert.equal(spawnCalls.length, 0, 'spawn should not be called')
  })

  test('does not call confirmOrExit or spawn when CLI_DIR does not match cwd', async () => {
    const originalCliDir = process.env.CLI_DIR
    process.env.CLI_DIR = '/not/the/current/directory'

    const confirmCalls = []
    const spawnCalls = []

    try {
      await action(
        { yes: false },
        {
          isDockerInstalled: () => true,
          confirmOrExit: async (...args) => { confirmCalls.push(args) },
          spawn: (...args) => { spawnCalls.push(args); return fakeChildProcess() },
        }
      )
    } finally {
      if (originalCliDir === undefined) {
        delete process.env.CLI_DIR
      } else {
        process.env.CLI_DIR = originalCliDir
      }
    }

    assert.equal(confirmCalls.length, 0, 'confirmOrExit should not be called')
    assert.equal(spawnCalls.length, 0, 'spawn should not be called')
  })

  test('yes=true calls confirmOrExit (which resolves immediately) then spawn', async () => {
    const originalCliDir = process.env.CLI_DIR
    process.env.CLI_DIR = process.cwd()

    const confirmCalls = []
    const spawnCalls = []

    try {
      await action(
        { yes: true },
        {
          isDockerInstalled: () => true,
          confirmOrExit: async (...args) => { confirmCalls.push(args) },
          spawn: (...args) => { spawnCalls.push(args); return fakeChildProcess() },
        }
      )
    } finally {
      if (originalCliDir === undefined) {
        delete process.env.CLI_DIR
      } else {
        process.env.CLI_DIR = originalCliDir
      }
    }

    assert.equal(confirmCalls.length, 1, 'confirmOrExit should be called once')
    assert.equal(confirmCalls[0][1], true, 'confirmOrExit should receive yes=true')
    assert.equal(spawnCalls.length, 1, 'spawn should be called once')
    assert.equal(spawnCalls[0][0], 'docker compose down -v')
  })

  test('when confirmOrExit rejects (declined/non-interactive), spawn is never called', async () => {
    const originalCliDir = process.env.CLI_DIR
    process.env.CLI_DIR = process.cwd()

    const spawnCalls = []

    try {
      await action(
        { yes: false },
        {
          isDockerInstalled: () => true,
          confirmOrExit: async () => { throw new Error('declined') },
          spawn: (...args) => { spawnCalls.push(args); return fakeChildProcess() },
        }
      )
    } finally {
      if (originalCliDir === undefined) {
        delete process.env.CLI_DIR
      } else {
        process.env.CLI_DIR = originalCliDir
      }
    }

    assert.equal(spawnCalls.length, 0, 'spawn should not be called')
  })
})
