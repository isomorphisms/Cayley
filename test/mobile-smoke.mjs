import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [menu, mobile, escape_hatch, visualizer, visualizer_layout, home] = await Promise.all([
  read('style/menu.css'),
  read('style/mobile.css'),
  read('style/mobile-escape-hatch.css'),
  read('visualizerFramework/visualizer.js'),
  read('visualizerFramework/visualizer.html'),
  read('index.html')
])

assert.match(menu, /@import\s+url\(['"]\.\/mobile\.css['"]\)/)
assert.match(menu, /@import\s+url\(['"]\.\/mobile-escape-hatch\.css['"]\)/)
assert.match(mobile, /@media[^\{]*max-width:\s*760px/)
assert.match(mobile, /body #controls/)
assert.match(mobile, /body #control-panel/)
assert.match(mobile, /#GroupTable tbody tr/)
assert.match(mobile, /min-height:\s*44px/)
assert.match(escape_hatch, /#escape-hatch/)
assert.match(escape_hatch, /#escape-destinations/)
assert.match(escape_hatch, /escape-open/)
assert.match(visualizer, /window\.matchMedia/)
assert.match(visualizer, /hideControls\(controls\)/)
assert.match(visualizer, /toggleEscapeMenu/)
assert.match(visualizer_layout, /id=["']escape-hatch["']/)
assert.match(visualizer_layout, /ƒ⁻¹/)
assert.match(visualizer_layout, /aria-expanded=["']false["']/)
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
