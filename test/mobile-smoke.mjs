import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [menu, mobile, visualizer, home] = await Promise.all([
  read('style/menu.css'),
  read('style/mobile.css'),
  read('visualizerFramework/visualizer.md'),
  read('index.html')
])

assert.match(menu, /@import\s+url\(['"]\.\/mobile\.css['"]\)/)
assert.match(mobile, /@media[^\{]*max-width:\s*760px/)
assert.match(mobile, /body #controls/)
assert.match(mobile, /body #control-panel/)
assert.match(mobile, /#GroupTable tbody tr/)
assert.match(mobile, /min-height:\s*44px/)
assert.match(visualizer, /window\.matchMedia/)
assert.match(visualizer, /hideControls\(controls\)/)
assert.match(home, /style\/mobile\.css/)
assert.match(home, /name=["']viewport["']/)

for (const page of [
  'GroupExplorer.html',
  'GroupInfo.html',
  'CayleyDiagram.html',
  'CycleGraph.html',
  'Multtable.html',
  'SymmetryObject.html',
  'Sheet.html'
]) {
  const html = await read(page)
  assert.match(html, /style\/menu\.css/, `${page} must load the shared mobile stylesheet through menu.css`)
  assert.match(html, /name=["']viewport["']/, `${page} must declare a mobile viewport`)
}

console.log('mobile smoke checks passed')
