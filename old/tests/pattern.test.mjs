import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function importSource (relative_path) {
    const source = await readFile(new URL(relative_path, import.meta.url), 'utf8');
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const Pattern = await importSource('../js/PatternLanguage.js');
const GroupPattern = await importSource('../js/GroupPattern.js');

class FakeElement {
    constructor (namespaceURI, localName) {
        this.namespaceURI = namespaceURI;
        this.localName = localName;
        this.children = [];
        this.attributes = new Map();
    }

    get firstChild () {
        return this.children.length === 0 ? null : this.children[0];
    }

    appendChild (child) {
        this.children.push(child);
        return child;
    }

    removeChild (child) {
        const index = this.children.indexOf(child);
        if (index >= 0) {
            this.children.splice(index, 1);
        }
        return child;
    }

    setAttribute (name, value) {
        this.attributes.set(name, String(value));
    }

    setAttributeNS (_namespace, name, value) {
        this.setAttribute(name, value);
    }
}

globalThis.document = {
    createElementNS: (namespaceURI, localName) => new FakeElement(namespaceURI, localName),
};

function assertMatrixClose (actual, expected, epsilon = 1e-6) {
    assert.equal(actual.length, expected.length);
    actual.forEach((entry, index) => {
        assert.ok(Math.abs(entry - expected[index]) < epsilon,
            `matrix entry ${index}: expected ${expected[index]}, got ${entry}`);
    });
}

async function loadGroup (filename) {
    const source = await readFile(new URL(`../groups/${filename}`, import.meta.url), 'utf8');
    return GroupPattern.groupFromGroupExplorerData(source, filename);
}

{
    const transform = Pattern.rotation(37, 11, -4);
    assertMatrixClose(
        Pattern.composeTransforms(transform, Pattern.inverseTransform(transform)),
        Pattern.identityTransform()
    );

    const mirror = Pattern.reflection(-2, 3, 7, 9);
    assertMatrixClose(
        Pattern.composeTransforms(mirror, mirror),
        Pattern.identityTransform()
    );
}

for (const filename of ['../patterns/conway-442.pattern', '../patterns/calegari-tracks.pattern']) {
    const source = await readFile(new URL(filename, import.meta.url), 'utf8');
    const program = Pattern.parsePattern(source);
    assert.ok(Object.keys(program.motifs).length > 0, `${filename} should define a motif`);
    assert.ok(program.drawings.length > 0, `${filename} should draw something`);
}

const expected_actions = [
    ['Z_5.group', 'cyclic', 5, 5],
    ['D_4.group', 'dihedral', 4, 8],
    ['S_3.group', 'dihedral', 3, 6],
    ['V_4.group', 'dihedral', 2, 4],
];

for (const [filename, kind, rotation_order, orbit_size] of expected_actions) {
    const group = await loadGroup(filename);
    const action = GroupPattern.planarActionForGroup(group);
    assert.ok(action != null, `${filename} should have a planar action`);
    assert.equal(action.kind, kind, `${filename} action kind`);
    assert.equal(action.rotationOrder, rotation_order, `${filename} rotation order`);
    assert.equal(action.orbitSize, orbit_size, `${filename} orbit size`);

    const renamed_group = {...group, shortName: 'renamed fixture'};
    assert.equal(GroupPattern.planarActionForGroup(renamed_group).kind, kind,
        `${filename} classification must not depend on its name`);

    const program = Pattern.parsePattern(GroupPattern.patternSourceForGroup(group));
    const orbit = Pattern.enumerateGroup(program, 'seed', orbit_size + 4);
    assert.equal(orbit.length, orbit_size, `${filename} generated orbit size`);

    const svg = new FakeElement('http://www.w3.org/2000/svg', 'svg');
    const statistics = Pattern.renderPattern(program, svg);
    assert.equal(statistics.instances, orbit_size, `${filename} rendered copies`);
    assert.equal(statistics.motifs, 1, `${filename} rendered motif count`);
}

for (const filename of ['Q_4.group', 'A_4.group']) {
    const group = await loadGroup(filename);
    assert.equal(GroupPattern.planarActionForGroup(group), null,
        `${filename} should not be assigned a fake faithful planar action`);
    assert.throws(
        () => GroupPattern.patternSourceForGroup(group),
        /cyclic or dihedral/,
        `${filename} should explain the 2D limitation`
    );
}

{
    const cyclic_source = await readFile(new URL('../groups/Z_5.group', import.meta.url), 'utf8');
    const parsed = GroupPattern.groupFromGroupExplorerData(cyclic_source, 'fallback');
    assert.equal(parsed.shortName, 'Z_5');
    assert.equal(parsed.multtable.length, 5);

    assert.throws(
        () => GroupPattern.groupFromGroupExplorerData('<group></group>'),
        /no multiplication table/
    );
}

{
    const library_page = await readFile(new URL('../GroupExplorer.html', import.meta.url), 'utf8');
    const pattern_page = await readFile(new URL('../Pattern.js', import.meta.url), 'utf8');
    assert.match(library_page, /Pattern\.html\?groupURL=/,
        'group library should link a selected group to Pattern.html');
    assert.match(library_page, /MutationObserver/,
        'cached group rows should be repaired with the pattern link');
    assert.match(pattern_page, /searchParams\.get\('groupURL'\)/,
        'pattern page should read the selected group URL');
    assert.match(pattern_page, /patternSourceForGroup\(group\)/,
        'selected group should compile to pattern source');
}

assert.equal(Pattern.conwayOrbifoldGenerators('*442', 84).length, 4);
assert.throws(() => Pattern.conwayOrbifoldGenerators('*not-yet', 84), /not shorthand yet/);

console.log('pattern tests passed');
