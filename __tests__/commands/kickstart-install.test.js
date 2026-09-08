import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateEmail,
  validatePassword,
  resolveInstallAnswers,
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

  test('rejects a password shorter than 8 characters', () => {
    const result = validatePassword('short')
    assert.notEqual(result, true)
    assert.match(result, /8 characters/)
  })

  test('rejects a 7-character password', () => {
    const result = validatePassword('1234567')
    assert.notEqual(result, true)
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
  test('email question carries a validate function that rejects bad input', async () => {
    let capturedQuestions

    const mockPrompt = async (questions) => {
      capturedQuestions = questions
      return { email: 'good@example.com', password: 'goodpassword', appName: 'App' }
    }

    await resolveInstallAnswers({}, mockPrompt)

    const emailQuestion = capturedQuestions.find((q) => q.name === 'email')
    assert.ok(emailQuestion, 'email question should exist')
    assert.ok(typeof emailQuestion.validate === 'function', 'email question should have validate')
    assert.equal(emailQuestion.validate('good@example.com'), true)
    assert.notEqual(emailQuestion.validate('bad'), true)
  })

  test('password question carries a validate function that rejects short input', async () => {
    let capturedQuestions

    const mockPrompt = async (questions) => {
      capturedQuestions = questions
      return { email: 'good@example.com', password: 'goodpassword', appName: 'App' }
    }

    await resolveInstallAnswers({}, mockPrompt)

    const passwordQuestion = capturedQuestions.find((q) => q.name === 'password')
    assert.ok(passwordQuestion, 'password question should exist')
    assert.ok(typeof passwordQuestion.validate === 'function', 'password question should have validate')
    assert.equal(passwordQuestion.validate('longenough'), true)
    assert.notEqual(passwordQuestion.validate('short'), true)
    assert.notEqual(passwordQuestion.validate(''), true)
  })
})
