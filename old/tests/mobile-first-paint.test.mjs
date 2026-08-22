import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const source = await readFile(new URL('../MobileGroup.js', import.meta.url), 'utf8')
const {default: MobileGroup} = await import('data:text/javascript,' + encodeURIComponent(source))

const fixture = `<group>
<multtable>
<row>0 1 2 3</row>
<row>1 0 3 2</row>
<row>2 3 0 1</row>
<row>3 2 1 0</row>
</multtable>
<generators list="1 2"/>
<symmetryobject><point x="ignored"/></symmetryobject>
</group>`

const group = new MobileGroup(fixture)
assert.equal(group.order, 4)
assert.deepEqual(group.generators, [[1, 2]])
assert.equal(group._rows.filter(Boolean).length, 0)

for (const generator of group.generators[0]) {
  for (const element of group.elements) group.mult(generator, element)
}
assert.equal(group._rows.filter(Boolean).length, 2)

for (const row of group.elements) {
  for (const column of group.elements) group.mult(row, column)
}
assert.equal(group._rows.filter(Boolean).length, 4)

const mobile = await readFile(new URL('../Mobile.js', import.meta.url), 'utf8')
const html = await readFile(new URL('../Mobile.html', import.meta.url), 'utf8')

for (const forbidden of ["./js/Library.js", "./js/XMLGroup.js", "./js/CayleyDiagramView.js", "./js/MulttableView.js", 'toDataURL']) {
  assert.equal(mobile.includes(forbidden), false)
}
assert.equal(html.toLowerCase().includes('jquery'), false)
assert.ok(mobile.indexOf('createCayleyCanvas(group, size)') < mobile.indexOf('await afterPaint()'))
assert.ok(mobile.indexOf('await afterPaint()') < mobile.indexOf("await import('./MobileTable.js')"))
