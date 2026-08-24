// @flow

/*
 * Bridge between Group Explorer's finite multiplication-table groups and the
 * 2D PatternLanguage frontend.
 *
 * A finite subgroup of the Euclidean isometry group of the plane is cyclic or
 * dihedral (up to conjugacy).  We therefore recognize those groups from their
 * multiplication tables and compile a canonical faithful planar action.  We
 * deliberately do not fake planar actions for the other finite groups.
 */

export class GroupPatternError extends Error {
    constructor (message) {
        super(message);
        this.name = 'GroupPatternError';
    }
}

function cleanLabel (label) {
    return String(label == null ? 'Selected group' : label).replace(/\s+/g, ' ').trim();
}

function decodeXMLAttribute (value) {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

export function groupFromGroupExplorerData (source, fallback_name = 'Selected group') {
    if (typeof source !== 'string' || source.trim() === '') {
        throw new GroupPatternError('group data is empty');
    }

    const trimmed = source.trim();
    if (trimmed.startsWith('{')) {
        let group;
        try {
            group = JSON.parse(trimmed);
        } catch (error) {
            throw new GroupPatternError(`could not parse group JSON: ${error.message}`);
        }
        if (group == null || !Array.isArray(group.multtable)) {
            throw new GroupPatternError('group JSON has no multiplication table');
        }
        return {
            shortName: cleanLabel(group.shortName || fallback_name),
            multtable: group.multtable,
        };
    }

    const table_match = trimmed.match(/<multtable\b[^>]*>([\s\S]*?)<\/multtable>/i);
    if (table_match == null) {
        throw new GroupPatternError('group XML has no multiplication table');
    }

    const rows = Array.from(
        table_match[1].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi),
        (match) => match[1]
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((entry) => Number(entry))
    );

    const name_match = trimmed.match(/<name\b[^>]*\btext=(['"])(.*?)\1/i);
    return {
        shortName: cleanLabel(name_match == null ? fallback_name : decodeXMLAttribute(name_match[2])),
        multtable: rows,
    };
}

function checkedTable (group) {
    const table = group == null ? null : group.multtable;
    if (!Array.isArray(table) || table.length === 0) {
        throw new GroupPatternError('group needs a non-empty multiplication table');
    }

    const order = table.length;
    for (let row_index = 0; row_index < order; row_index++) {
        const row = table[row_index];
        if (!Array.isArray(row) || row.length !== order) {
            throw new GroupPatternError('multiplication table must be square');
        }
        for (const entry of row) {
            if (!Number.isInteger(entry) || entry < 0 || entry >= order) {
                throw new GroupPatternError('multiplication table entries must be element indices');
            }
        }
        if (table[0][row_index] !== row_index || table[row_index][0] !== row_index) {
            throw new GroupPatternError('Group Explorer multiplication tables must use element 0 as identity');
        }
    }
    return table;
}

function multiply (table, left, right) {
    return table[left][right];
}

function elementOrder (table, element) {
    if (element === 0) {
        return 1;
    }

    let current = 0;
    for (let exponent = 1; exponent <= table.length; exponent++) {
        current = multiply(table, current, element);
        if (current === 0) {
            return exponent;
        }
    }
    throw new GroupPatternError(`element ${element} did not return to the identity`);
}

function elementPowers (table, generator) {
    const result = [];
    let current = 0;
    while (!result.includes(current)) {
        result.push(current);
        current = multiply(table, current, generator);
    }
    return result;
}

function inverseElement (table, element) {
    const inverse = table[element].indexOf(0);
    if (inverse < 0) {
        throw new GroupPatternError(`element ${element} has no inverse`);
    }
    return inverse;
}

function cyclicAction (table) {
    for (let element = 0; element < table.length; element++) {
        if (elementOrder(table, element) === table.length) {
            return {
                kind: 'cyclic',
                order: table.length,
                rotationOrder: table.length,
                rotationElement: element,
                orbitSize: table.length,
            };
        }
    }
    return null;
}

function dihedralAction (table) {
    const order = table.length;
    if (order < 4 || order % 2 !== 0) {
        return null;
    }

    const rotation_order = order / 2;
    for (let rotation_element = 1; rotation_element < order; rotation_element++) {
        if (elementOrder(table, rotation_element) !== rotation_order) {
            continue;
        }

        const rotation_powers = elementPowers(table, rotation_element);
        const rotations = new Set(rotation_powers);
        const inverse_rotation = inverseElement(table, rotation_element);

        for (let reflection_element = 1; reflection_element < order; reflection_element++) {
            if (rotations.has(reflection_element) || elementOrder(table, reflection_element) !== 2) {
                continue;
            }

            const conjugate = multiply(
                table,
                reflection_element,
                multiply(table, rotation_element, reflection_element)
            );
            if (conjugate !== inverse_rotation) {
                continue;
            }

            const generated = new Set(rotation_powers);
            rotation_powers.forEach((power) => {
                generated.add(multiply(table, reflection_element, power));
            });
            if (generated.size === order) {
                return {
                    kind: 'dihedral',
                    order,
                    rotationOrder: rotation_order,
                    rotationElement: rotation_element,
                    reflectionElement: reflection_element,
                    orbitSize: order,
                };
            }
        }
    }
    return null;
}

export function planarActionForGroup (group) {
    const table = checkedTable(group);
    return cyclicAction(table) || dihedralAction(table);
}

function unsupportedMessage (group) {
    const label = cleanLabel(group == null ? null : group.shortName);
    return `${label} has no faithful finite Euclidean-plane action in the current 2D pattern IR. ` +
        'Finite planar point groups are cyclic or dihedral; other groups need a 3D or explicitly non-faithful action.';
}

export function patternSourceForGroup (group) {
    const action = planarActionForGroup(group);
    if (action == null) {
        throw new GroupPatternError(unsupportedMessage(group));
    }

    const label = cleanLabel(group.shortName);
    const lines = [
        `# Generated from Group Explorer group ${label}`,
        `# element ${action.rotationElement} -> rotation of order ${action.rotationOrder}`,
    ];
    if (action.kind === 'dihedral') {
        lines.push(`# element ${action.reflectionElement} -> reflection`);
    }

    lines.push(
        'canvas 720 720',
        'viewport -160 -160 160 160',
        'background transparent',
        'stroke currentColor 3',
        'fill none',
        '',
        'motif seed',
        '    move 52 -18',
        '    line 126 -8',
        '    line 88 31',
        '    line 55 10',
        '    close',
        '    circle 108 11 5',
        'end',
        ''
    );

    if (action.rotationOrder > 1) {
        const degrees = Number((360 / action.rotationOrder).toFixed(12));
        lines.push(`generator group_turn rotate ${degrees}`);
    }
    if (action.kind === 'dihedral') {
        lines.push('generator group_mirror reflect 0 0 1 0');
    }
    lines.push(`orbit seed ${action.orbitSize}`, '');

    return lines.join('\n');
}
