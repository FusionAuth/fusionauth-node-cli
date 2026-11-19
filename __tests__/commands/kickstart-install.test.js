import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateEmail,
  validatePassword,
  resolveInstallAnswers,
  resolveResourcesDir,
} from '../../src/commands/kickstart-install.js'

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------

describe('validateEmail()', () => {
  test('accepts a standard email address', () => {
    assert.equal(validateEmail('admin@example.com'), true)
  })

  test('accepts an email with subdomain', () => {
    assert.equal(validateEmail('user@mail.example.co.uk'), true)
  })

  test('rejects an address with no @', () => {
    const result = validateEmail('notanemail')
    assert.notEqual(result, true)
    assert.match(result, /valid email/)
  })

  test('rejects an address with no domain', () => {
    const result = validateEmail('user@')
    assert.notEqual(result, true)
  })

  test('rejects an empty string', () => {
    const result = validateEmail('')
    assert.notEqual(result, true)
  })
})

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------

describe('validatePassword()', () => {
  test('accepts a password of exactly 8 characters', () => {
    assert.equal(validatePassword('abcdefgh'), true)
  })

  test('accepts a long password', () => {
    assert.equal(validatePassword('supersecretpassword123'), true)
  })

  test('rejects an empty password', () => {
    const result = validatePassword('')
    assert.notEqual(result, true)
    assert.match(result, /required/)
  })

  test('rejects a password one character short of the minimum', () => {
    const result = validatePassword('1234567')
    assert.notEqual(result, true)
    assert.match(result, /8 characters/)
  })
})

// ---------------------------------------------------------------------------
// resolveInstallAnswers — CLI options only (no prompts)
// ---------------------------------------------------------------------------

describe('resolveInstallAnswers() — all options provided', () => {
  let savedEnv

  beforeEach(() => {
    savedEnv = process.env.TEST_ADMIN_PASS
    process.env.TEST_ADMIN_PASS = 'supersecret'
  })

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.TEST_ADMIN_PASS
    } else {
      process.env.TEST_ADMIN_PASS = savedEnv
    }
  })

  test('returns answers from CLI options without calling promptFn', async () => {
    const neverCallMe = () => {
      throw new Error('promptFn should not have been called')
    }

    const answers = await resolveInstallAnswers(
      {
        adminEmail: 'agent@example.com',
        adminPasswordEnv: 'TEST_ADMIN_PASS',
        applicationName: 'My App',
      },
      neverCallMe
    )

    assert.equal(answers.email, 'agent@example.com')
    assert.equal(answers.password, 'supersecret')
    assert.equal(answers.appName, 'My App')
  })
})

// ---------------------------------------------------------------------------
// resolveInstallAnswers — no CLI options (all prompts)
// ---------------------------------------------------------------------------

describe('resolveInstallAnswers() — no options provided', () => {
  test('calls promptFn with questions for all three fields', async () => {
    let capturedQuestions

    const mockPrompt = async (questions) => {
      capturedQuestions = questions
      return { email: 'prompted@example.com', password: 'promptedpass', appName: 'Prompted App' }
    }

    const answers = await resolveInstallAnswers({}, mockPrompt)

    assert.equal(answers.email, 'prompted@example.com')
    assert.equal(answers.password, 'promptedpass')
    assert.equal(answers.appName, 'Prompted App')

    const names = capturedQuestions.map((q) => q.name)
    assert.ok(names.includes('email'), 'should ask for email')
    assert.ok(names.includes('password'), 'should ask for password')
    assert.ok(names.includes('appName'), 'should ask for appName')
  })
})

// ---------------------------------------------------------------------------
// resolveInstallAnswers — partial CLI options
// ---------------------------------------------------------------------------

describe('resolveInstallAnswers() — only adminEmail provided', () => {
  test('does not include email in prompt questions', async () => {
    let capturedQuestions

    const mockPrompt = async (questions) => {
      capturedQuestions = questions
      return { password: 'promptedpass', appName: 'Prompted App' }
    }

    const answers = await resolveInstallAnswers(
      { adminEmail: 'cli@example.com' },
      mockPrompt
    )

    assert.equal(answers.email, 'cli@example.com')
    assert.equal(answers.password, 'promptedpass')
    assert.equal(answers.appName, 'Prompted App')

    const names = capturedQuestions.map((q) => q.name)
    assert.ok(!names.includes('email'), 'should not ask for email')
    assert.ok(names.includes('password'), 'should ask for password')
    assert.ok(names.includes('appName'), 'should ask for appName')
  })
})

describe('resolveInstallAnswers() — only applicationName provided', () => {
  test('does not include appName in prompt questions', async () => {
    let capturedQuestions

    const mockPrompt = async (questions) => {
      capturedQuestions = questions
      return { email: 'prompted@example.com', password: 'promptedpass' }
    }

    const answers = await resolveInstallAnswers(
      { applicationName: 'CLI App' },
      mockPrompt
    )

    assert.equal(answers.appName, 'CLI App')

    const names = capturedQuestions.map((q) => q.name)
    assert.ok(!names.includes('appName'), 'should not ask for appName')
    assert.ok(names.includes('email'), 'should ask for email')
    assert.ok(names.includes('password'), 'should ask for password')
  })
})

// ---------------------------------------------------------------------------
// resolveInstallAnswers — adminPasswordEnv resolution
// ---------------------------------------------------------------------------

describe('resolveInstallAnswers() — admin-password-env', () => {
  let savedEnv

  beforeEach(() => {
    savedEnv = process.env.MY_ADMIN_PASS
  })

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.MY_ADMIN_PASS
    } else {
      process.env.MY_ADMIN_PASS = savedEnv
    }
  })

  test('reads the password from the named environment variable', async () => {
    process.env.MY_ADMIN_PASS = 'envpassword'

    const neverCallMe = () => { throw new Error('promptFn should not have been called') }

    const answers = await resolveInstallAnswers(
      {
        adminEmail: 'agent@example.com',
        adminPasswordEnv: 'MY_ADMIN_PASS',
        applicationName: 'Test App',
      },
      neverCallMe
    )

    assert.equal(answers.password, 'envpassword')
  })

  test('throws when the named environment variable is not set', async () => {
    delete process.env.MY_ADMIN_PASS

    await assert.rejects(
      () =>
        resolveInstallAnswers(
          { adminEmail: 'agent@example.com', adminPasswordEnv: 'MY_ADMIN_PASS', applicationName: 'App' },
          () => { throw new Error('should not prompt') }
        ),
      (err) => {
        assert.match(err.message, /MY_ADMIN_PASS/)
        assert.match(err.message, /not set/)
        return true
      }
    )
  })
})

// ---------------------------------------------------------------------------
// resolveInstallAnswers — CLI validation errors
// ---------------------------------------------------------------------------

describe('resolveInstallAnswers() — CLI validation errors', () => {
  test('throws on invalid --admin-email', async () => {
    await assert.rejects(
      () =>
        resolveInstallAnswers(
          { adminEmail: 'not-an-email', adminPasswordEnv: undefined, applicationName: undefined },
          () => { throw new Error('should not prompt') }
        ),
      (err) => {
        assert.match(err.message, /admin-email/)
        assert.match(err.message, /valid email/)
        return true
      }
    )
  })

  test('throws when env var password is too short', async () => {
    process.env.MY_ADMIN_PASS = 'short'

    try {
      await assert.rejects(
        () =>
          resolveInstallAnswers(
            {
              adminEmail: 'agent@example.com',
              adminPasswordEnv: 'MY_ADMIN_PASS',
              applicationName: 'App',
            },
            () => { throw new Error('should not prompt') }
          ),
        (err) => {
          assert.match(err.message, /admin-password-env/)
          assert.match(err.message, /8 characters/)
          return true
        }
      )
    } finally {
      delete process.env.MY_ADMIN_PASS
    }
  })

  test('throws when env var password is empty', async () => {
    process.env.MY_ADMIN_PASS = ''

    try {
      await assert.rejects(
        () =>
          resolveInstallAnswers(
            {
              adminEmail: 'agent@example.com',
              adminPasswordEnv: 'MY_ADMIN_PASS',
              applicationName: 'App',
            },
            () => { throw new Error('should not prompt') }
          ),
        (err) => {
          assert.match(err.message, /admin-password-env/)
          assert.match(err.message, /required/)
          return true
        }
      )
    } finally {
      delete process.env.MY_ADMIN_PASS
    }
  })
})

// ---------------------------------------------------------------------------
// resolveInstallAnswers — inquirer validate functions are wired correctly
// ---------------------------------------------------------------------------

describe('resolveInstallAnswers() — inquirer validate functions', () => {
  test('email question uses validateEmail directly', async () => {
    let capturedQuestions

    const mockPrompt = async (questions) => {
      capturedQuestions = questions
      return { email: 'good@example.com', password: 'goodpassword', appName: 'App' }
    }

    await resolveInstallAnswers({}, mockPrompt)

    const emailQuestion = capturedQuestions.find((q) => q.name === 'email')
    assert.ok(emailQuestion, 'email question should exist')
    assert.equal(emailQuestion.validate, validateEmail)
  })

  test('password question uses validatePassword directly', async () => {
    let capturedQuestions

    const mockPrompt = async (questions) => {
      capturedQuestions = questions
      return { email: 'good@example.com', password: 'goodpassword', appName: 'App' }
    }

    await resolveInstallAnswers({}, mockPrompt)

    const passwordQuestion = capturedQuestions.find((q) => q.name === 'password')
    assert.ok(passwordQuestion, 'password question should exist')
    assert.equal(passwordQuestion.validate, validatePassword)
  })
})

// ---------------------------------------------------------------------------
// resolveResourcesDir()
// ---------------------------------------------------------------------------
//
// These use synthetic temp directories (via the injectable baseDir param)
// rather than the real repo layout, so all three logic branches are
// deterministically exercised regardless of whether a build has run —
// including the dist-layout branch, which this test file could never reach
// otherwise, since it always imports src/commands/kickstart-install.js via
// tsx, fixing __dirname to .../src/commands for the whole test run.

describe('resolveResourcesDir()', () => {
  const createdDirs = []

  function mkTempDir(prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
    createdDirs.push(dir)
    return dir
  }

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('returns baseDir/resources when it exists (dist layout)', () => {
    const baseDir = mkTempDir('resolve-resources-dist-')
    const expected = path.join(baseDir, 'resources')
    fs.mkdirSync(expected)

    assert.equal(resolveResourcesDir(baseDir), expected)
  })

  test('falls back to baseDir/../resources when baseDir/resources is missing (src layout)', () => {
    const parent = mkTempDir('resolve-resources-src-')
    const baseDir = path.join(parent, 'commands')
    fs.mkdirSync(baseDir)
    const expected = path.join(parent, 'resources')
    fs.mkdirSync(expected)
    // Deliberately no baseDir/resources — only the parent-level fallback exists.

    assert.equal(resolveResourcesDir(baseDir), expected)
  })

  test('prefers the dist layout when both exist', () => {
    const parent = mkTempDir('resolve-resources-both-')
    const baseDir = path.join(parent, 'commands')
    fs.mkdirSync(baseDir)
    fs.mkdirSync(path.join(parent, 'resources'))
    const expected = path.join(baseDir, 'resources')
    fs.mkdirSync(expected)

    assert.equal(resolveResourcesDir(baseDir), expected)
  })

  test('throws a clear error when neither layout exists', () => {
    const baseDir = mkTempDir('resolve-resources-none-')

    assert.throws(
      () => resolveResourcesDir(baseDir),
      /Could not locate kickstart resources directory/
    )
  })
})

// ---------------------------------------------------------------------------
// resolveResourcesDir() against the real built artifact (dist/)
// ---------------------------------------------------------------------------
//
// The tests above verify the function's logic in isolation; this verifies
// the actual distributable: that `npm run build`'s copy-files step really
// produces a dist/commands/resources directory the compiled command can
// find at its real __dirname, with the files kickstart:install needs.
// Skipped (not failed) when dist/ hasn't been built yet, so `test:unit`
// still works without requiring a build first — this is CI-meaningful
// since CI always runs `npm run build` before `npm test`.

describe('resolveResourcesDir() against dist/ (built artifact)', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distModulePath = '../../dist/commands/kickstart-install.js'
  const distModuleFile = path.join(__dirname, distModulePath)

  test('resolves dist/commands/resources from the compiled module', async (t) => {
    if (!fs.existsSync(distModuleFile)) {
      t.skip('dist/ has not been built — run `npm run build` first to exercise this test')
      return
    }

    const dist = await import(distModulePath)
    const resourcesDir = dist.resolveResourcesDir()

    assert.equal(resourcesDir, path.join(path.dirname(distModuleFile), 'resources'))
    assert.ok(fs.existsSync(resourcesDir), `${resourcesDir} should exist`)
    assert.ok(
      fs.existsSync(path.join(resourcesDir, 'kickstart', 'fusionauth')),
      `${resourcesDir}/kickstart/fusionauth should exist`
    )
    assert.ok(
      fs.existsSync(path.join(resourcesDir, 'kickstart', 'kickstart.json')),
      `${resourcesDir}/kickstart/kickstart.json should exist`
    )
  })
})
