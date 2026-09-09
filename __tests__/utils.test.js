import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { isConfirmationAccepted, handleConfirmationAnswer, confirmOrExit } from "../src/utils.js"

describe('isConfirmationAccepted()', () => {
  test('accepts "y"', () => {
    assert.equal(isConfirmationAccepted('y'), true)
  })

  test('accepts "yes"', () => {
    assert.equal(isConfirmationAccepted('yes'), true)
  })

  test('accepts case-insensitive variants', () => {
    assert.equal(isConfirmationAccepted('Y'), true)
    assert.equal(isConfirmationAccepted('YES'), true)
    assert.equal(isConfirmationAccepted('Yes'), true)
  })

  test('accepts whitespace-padded variants', () => {
    assert.equal(isConfirmationAccepted(' y '), true)
    assert.equal(isConfirmationAccepted(' yes '), true)
  })

  test('rejects "n"', () => {
    assert.equal(isConfirmationAccepted('n'), false)
  })

  test('rejects empty string', () => {
    assert.equal(isConfirmationAccepted(''), false)
  })

  test('rejects unrelated text', () => {
    assert.equal(isConfirmationAccepted('nope'), false)
    assert.equal(isConfirmationAccepted('ye'), false)
    assert.equal(isConfirmationAccepted('sure'), false)
  })
})

describe('handleConfirmationAnswer()', () => {
  test('accepted answer calls resolve, not reject or process.exit', (t) => {
    const exitMock = t.mock.method(process, 'exit', () => {})
    let resolved = false
    let rejected = false

    handleConfirmationAnswer('y', () => { resolved = true }, () => { rejected = true })

    assert.equal(resolved, true)
    assert.equal(rejected, false)
    assert.equal(exitMock.mock.calls.length, 0)
  })

  test('declined answer calls process.exit(0)', (t) => {
    const exitMock = t.mock.method(process, 'exit', () => {})

    handleConfirmationAnswer('n', () => {}, () => {})

    assert.equal(exitMock.mock.calls.length, 1)
    assert.equal(exitMock.mock.calls[0].arguments[0], 0)
  })

  test('declined answer rejects rather than resolving when process.exit is mocked (does not actually exit)', (t) => {
    t.mock.method(process, 'exit', () => {})
    let resolved = false
    let rejectedWith

    handleConfirmationAnswer('n', () => { resolved = true }, (err) => { rejectedWith = err })

    assert.equal(resolved, false, 'resolve should never be called on decline')
    assert.ok(rejectedWith instanceof Error, 'reject should be called with an Error')
  })
})

describe('confirmOrExit()', () => {
  test('yes=true resolves immediately without touching stdin/stdout', async (t) => {
    const exitMock = t.mock.method(process, 'exit', () => {})

    await confirmOrExit('This is risky', true)

    assert.equal(exitMock.mock.calls.length, 0, 'process.exit should not be called')
  })

  test('non-interactive (stdin not a TTY) exits with code 1', async (t) => {
    const exitMock = t.mock.method(process, 'exit', () => {})
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    process.stdin.isTTY = false
    process.stdout.isTTY = true

    try {
      await confirmOrExit('This is risky', false)
    } finally {
      process.stdin.isTTY = originalStdinTTY
      process.stdout.isTTY = originalStdoutTTY
    }

    assert.equal(exitMock.mock.calls.length, 1, 'process.exit should be called once')
    assert.equal(exitMock.mock.calls[0].arguments[0], 1)
  })

  test('non-interactive (stdout not a TTY) exits with code 1', async (t) => {
    const exitMock = t.mock.method(process, 'exit', () => {})
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    process.stdin.isTTY = true
    process.stdout.isTTY = false

    try {
      await confirmOrExit('This is risky', false)
    } finally {
      process.stdin.isTTY = originalStdinTTY
      process.stdout.isTTY = originalStdoutTTY
    }

    assert.equal(exitMock.mock.calls.length, 1, 'process.exit should be called once')
    assert.equal(exitMock.mock.calls[0].arguments[0], 1)
  })

  test('non-interactive (both not TTYs) exits with code 1', async (t) => {
    const exitMock = t.mock.method(process, 'exit', () => {})
    const originalStdinTTY = process.stdin.isTTY
    const originalStdoutTTY = process.stdout.isTTY

    process.stdin.isTTY = false
    process.stdout.isTTY = false

    try {
      await confirmOrExit('This is risky', false)
    } finally {
      process.stdin.isTTY = originalStdinTTY
      process.stdout.isTTY = originalStdoutTTY
    }

    assert.equal(exitMock.mock.calls.length, 1, 'process.exit should be called once')
    assert.equal(exitMock.mock.calls[0].arguments[0], 1)
  })
})
