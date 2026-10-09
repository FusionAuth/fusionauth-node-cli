import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Creates a real, unique temporary directory outside the repo (under the OS
 * temp dir) for tests that need to exercise real filesystem behavior instead
 * of mocking it. Prefer this over mock-fs, which has had shaky support for
 * newer Node versions.
 *
 * @param prefix Prefix for the generated directory name.
 * @returns The absolute path to the newly created temp directory.
 */
export function createTempDir(prefix = 'fa-cli-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/**
 * Recursively removes a temp directory created by createTempDir(). Safe to
 * call even if the directory doesn't exist.
 *
 * @param dir The directory to remove.
 */
export function removeTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}
