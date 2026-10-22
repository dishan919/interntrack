import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const colors = Object.fromEntries([...css.matchAll(/(--[a-z-]+):\s*(#[a-f0-9]{6})/g)].map(match => [match[1], match[2]]))
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
}
function contrast(first, second) {
  const values = [luminance(colors[first]), luminance(colors[second])].sort((a, b) => b - a)
  return (values[0] + .05) / (values[1] + .05)
}
test('design palette preserves readable text on workspace, sidebar, actions and semantic badges', () => {
  const pairs = [
    ['--text-primary', '--surface-card'], ['--text-secondary', '--surface-page'],
    ['--text-on-dark', '--surface-sidebar'], ['--text-sidebar-muted', '--surface-sidebar'],
    ['--text-on-accent', '--surface-sidebar-active'], ['--text-on-accent', '--color-primary'],
    ['--text-on-accent', '--color-primary-hover'], ['--color-primary', '--color-primary-soft'],
    ['--color-danger', '--color-danger-soft'], ['--color-warning', '--color-warning-soft'],
    ['--color-success', '--color-success-soft'], ['--color-info', '--color-info-soft'],
    ['--color-interview', '--color-interview-soft'],
  ]
  for (const [foreground, background] of pairs) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}: ${contrast(foreground, background)}`)
  assert.ok(contrast('--border-strong', '--surface-card') >= 3, 'input boundary contrast')
})
