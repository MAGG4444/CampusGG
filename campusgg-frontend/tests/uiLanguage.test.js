import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('application entry points declare English as the interface language', async () => {
  for (const path of ['../index.html', '../../frontend/index.html']) {
    const html = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.match(html, /<html\s+lang=["']en["']/i)
  }
})
