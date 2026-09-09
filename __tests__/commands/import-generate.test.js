import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { getDeprecatedFlagUsage, importGenerate } from "../../src/commands/import-generate.js"

describe('getDeprecatedFlagUsage()', () => {
  test('returns empty array when no deprecated flags are used', () => {
    const usage = getDeprecatedFlagUsage(['node', 'script', '--number-of-files', '5'])
    assert.deepEqual(usage, [])
  })

  test('detects a bare deprecated flag (--flag value form)', () => {
    const usage = getDeprecatedFlagUsage(['node', 'script', '--numberOfFiles', '5'])
    assert.equal(usage.length, 1)
    assert.deepEqual(usage[0], ['--numberOfFiles', '--number-of-files'])
  })

  test('detects a deprecated flag in --flag=value form', () => {
    const usage = getDeprecatedFlagUsage(['node', 'script', '--numberOfFiles=5'])
    assert.equal(usage.length, 1)
    assert.deepEqual(usage[0], ['--numberOfFiles', '--number-of-files'])
  })

  test('detects multiple deprecated flags used together', () => {
    const usage = getDeprecatedFlagUsage(['node', 'script', '--numberOfFiles', '5', '--groupId=abc'])
    const oldFlags = usage.map(([old]) => old)
    assert.ok(oldFlags.includes('--numberOfFiles'))
    assert.ok(oldFlags.includes('--groupId'))
    assert.equal(usage.length, 2)
  })

  test('does not flag the new kebab-case form as deprecated', () => {
    const usage = getDeprecatedFlagUsage(['node', 'script', '--group-id', 'abc'])
    assert.deepEqual(usage, [])
  })
})

describe('import:generate option parsing', () => {
  test('deprecated --numberOfFiles populates the same option as --number-of-files', async () => {
    let capturedOptions
    importGenerate.action((options) => { capturedOptions = options })

    await importGenerate.parseAsync(['--numberOfFiles', '5'], { from: 'user' })

    assert.equal(capturedOptions.numberOfFiles, '5')
  })

  test('--number-of-files populates the same numberOfFiles property', async () => {
    let capturedOptions
    importGenerate.action((options) => { capturedOptions = options })

    await importGenerate.parseAsync(['--number-of-files', '7'], { from: 'user' })

    assert.equal(capturedOptions.numberOfFiles, '7')
  })

  test('deprecated --groupId populates the same option as --group-id', async () => {
    let capturedOptions
    importGenerate.action((options) => { capturedOptions = options })

    await importGenerate.parseAsync(['--groupId', 'abc-123'], { from: 'user' })

    assert.equal(capturedOptions.groupId, 'abc-123')
  })
})
