import { describe, test, afterEach } from "node:test"
import assert from "node:assert"
import nock from "nock"

export function apply() {
  describe('Apply Command Integration', () => {
    afterEach(() => {
      nock.cleanAll()
    })
  })
}
