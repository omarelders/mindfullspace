#!/usr/bin/env node
// Runs vitest with NODE_ENV forced to test regardless of the ambient shell
// environment (CI sandboxes sometimes export NODE_ENV=production, which makes
// React resolve its production build and breaks @testing-library act()).
// Usage: node scripts/gate-test.mjs [file ...]   (no files = whole suite)
import { spawnSync } from 'node:child_process'

const files = process.argv.slice(2)
process.env.NODE_ENV = 'test'

const res = spawnSync('npm', ['test', '--', '--run', ...files], {
  shell: process.platform === 'win32',
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 32 * 1024 * 1024,
})

const out = `${res.stdout || ''}\n${res.stderr || ''}`
const lines = out.split(/\r?\n/).filter(Boolean)
// Print per-file results plus the final summaries, with ANSI stripped so
// EXPECT regexes match plain text.
const plain = (s) => s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
const summary = lines.filter((l) => /Test Files|Tests\s|\(\d+ tests\)/.test(l))
console.log((summary.length ? summary : lines.slice(-6)).map(plain).join('\n'))
process.exit(res.status ?? 1)
