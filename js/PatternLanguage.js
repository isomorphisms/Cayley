// @flow

/*
 * PatternLanguage
 *
 * A small, dependency-free language for 2D motifs acted on by groups of
 * Euclidean isometries.  The parser produces a plain data object so another
 * frontend (Grease, Idriç, an ECMAScript fork, etc.) can target the same IR.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const EPSILON = 1e-7;
const DEFAULT_ORBIT_LIMIT = 5000;

export class PatternError extends Error {
    constructor (message, line_number = undefined) {
        super(line_number == undefined ? message : `line ${line_number}: ${message}`);
        this.name = 'PatternError';
        this.line_number = line_number;
    }
}

export function identityTransform () {
    return [1, 0, 0, 1, 0, 0];
}

export function composeTransforms (left, right) {
    const [a1, b1, c1, d1, e1, f1] = left;
    const [a2, b2, c2, d2, e2, f2] = right;
    return [
        a1*a2 + c1*b2,
        b1*a2 + d1*b2,
        a1*c2 + c1*d2,
        b1*c2 + d1*d2,
        a1*e2 + c1*f2 + e1,
        b1*e2 + d1*f2 + f1,
    ];
}

export function translation (x, y) {
    return [1, 0, 0, 1, x, y];
}

export function rotation (degrees, center_x = 0, center_y = 0) {
    const radians = degrees * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const turn = [cosine, sine, -sine, cosine, 0, 0];
    return composeTransforms(
        translation(center_x, center_y),
        composeTransforms(turn, translation(-center_x, -center_y))
    );
}

export function reflection (x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.hypot(dx, dy) < EPSILON) {
        throw new PatternError('a reflection line needs two different points');
    }

    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const reflect_across_x_axis = [1, 0, 0, -1, 0, 0];
    return composeTransforms(
        translation(x1, y1),
        composeTransforms(
            rotation(angle),
            composeTransforms(
                reflect_across_x_axis,
                composeTransforms(rotation(-angle), translation(-x1, -y1))
            )
        )
    );
}

export function glideReflection (x1, y1, x2, y2, distance) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < EPSILON) {
        throw new PatternError('a glide line needs two different points');
    }
    const glide = translation(distance * dx / length, distance * dy / length);
    return composeTransforms(glide, reflection(x1, y1, x2, y2));
}

export function inverseTransform (matrix) {
    const [a, b, c, d, e, f] = matrix;
    const determinant = a*d - b*c;
    if (Math.abs(determinant) < EPSILON) {
        throw new PatternError('non-invertible transform');
    }
    return [
        d/determinant,
        -b/determinant,
        -c/determinant,
        a/determinant,
        (c*f - d*e)/determinant,
        (b*e - a*f)/determinant,
    ];
}

function number (word, line_number, description) {
    const value = Number(word);
    if (!Number.isFinite(value)) {
        throw new PatternError(`${description} must be a number, got ${word}`, line_number);
    }
    return value;
}

function positiveNumber (word, line_number, description) {
    const value = number(word, line_number, description);
    if (!(value > 0)) {
        throw new PatternError(`${description} must be positive, got ${word}`, line_number);
    }
    return value;
}

function integer (word, line_number, description) {
    const value = number(word, line_number, description);
    if (!Number.isInteger(value)) {
        throw new PatternError(`${description} must be an integer, got ${word}`, line_number);
    }
    return value;
}

function wordsOnLine (line) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        return [];
    }

    // Inline // comments are allowed; # is deliberately not an inline comment
    // marker because CSS colors such as #1b1f23 are useful in pattern files.
    let source = line;
    let quote = null;
    for (let i = 0; i < source.length - 1; i++) {
        const character = source[i];
        if (quote != null) {
            if (character === '\\') {
                i += 1;
            } else if (character === quote) {
                quote = null;
            }
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '/' && source[i + 1] === '/') {
            source = source.slice(0, i);
            break;
        }
    }

    const matches = source.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+/g) || [];
    return matches.map((word) => {
        if ((word.startsWith('"') && word.endsWith('"')) ||
            (word.startsWith("'") && word.endsWith("'"))) {
            return word.slice(1, -1);
        }
        return word;
    });
}

function emptyBounds () {
    return {min_x: Infinity, min_y: Infinity, max_x: -Infinity, max_y: -Infinity};
}

function includePoint (bounds, x, y) {
    bounds.min_x = Math.min(bounds.min_x, x);
    bounds.min_y = Math.min(bounds.min_y, y);
    bounds.max_x = Math.max(bounds.max_x, x);
    bounds.max_y = Math.max(bounds.max_y, y);
}

function includeCircle (bounds, x, y, radius) {
    includePoint(bounds, x - radius, y - radius);
    includePoint(bounds, x + radius, y + radius);
}

function normalizedBounds (bounds) {
    if (!Number.isFinite(bounds.min_x)) {
        return {min_x: 0, min_y: 0, max_x: 0, max_y: 0};
    }
    return bounds;
}

function styleCopy (style) {
    return {stroke: style.stroke, stroke_width: style.stroke_width, fill: style.fill};
}

function newMotifState (name, style) {
    return {
        name,
        shapes: [],
        bounds: emptyBounds(),
        x: 0,
        y: 0,
        heading: 0,
        pen_down: true,
        path: '',
        path_started: false,
        path_style: styleCopy(style),
        style: styleCopy(style),
    };
}

function flushPath (motif) {
    if (motif.path_started && motif.path.trim() !== '') {
        motif.shapes.push({
            kind: 'path',
            d: motif.path.trim(),
            ...styleCopy(motif.path_style),
        });
    }
    motif.path = '';
    motif.path_started = false;
}

function ensurePathAtCurrentPoint (motif) {
    if (!motif.path_started) {
        motif.path = `M ${motif.x} ${motif.y}`;
        motif.path_started = true;
        motif.path_style = styleCopy(motif.style);
        includePoint(motif.bounds, motif.x, motif.y);
    }
}

function moveTurtle (motif, x, y, draw) {
    if (draw) {
        ensurePathAtCurrentPoint(motif);
        motif.path += ` L ${x} ${y}`;
    } else {
        flushPath(motif);
    }
    motif.x = x;
    motif.y = y;
    includePoint(motif.bounds, x, y);
}

function arcTurtle (motif, direction, radius, degrees) {
    if (degrees < 0) {
        return arcTurtle(motif, direction === 'left' ? 'right' : 'left', radius, -degrees);
    }
    if (degrees === 0) {
        return;
    }

    const heading_radians = motif.heading * Math.PI / 180;
    const normal_x = -Math.sin(heading_radians);
    const normal_y = Math.cos(heading_radians);
    const sign = direction === 'left' ? 1 : -1;
    const center_x = motif.x + sign * radius * normal_x;
    const center_y = motif.y + sign * radius * normal_y;
    const end_heading = motif.heading + sign * degrees;
    const end_radians = end_heading * Math.PI / 180;
    const end_normal_x = -Math.sin(end_radians);
    const end_normal_y = Math.cos(end_radians);
    const end_x = center_x - sign * radius * end_normal_x;
    const end_y = center_y - sign * radius * end_normal_y;

    if (motif.pen_down) {
        ensurePathAtCurrentPoint(motif);
        const large_arc = degrees > 180 ? 1 : 0;
        // SVG computes arcs in its native y-down coordinates.  Pattern content
        // is later flipped to mathematical y-up coordinates, so sweep=1 is a
        // mathematical left turn and sweep=0 is a right turn.
        const sweep = direction === 'left' ? 1 : 0;
        motif.path += ` A ${radius} ${radius} 0 ${large_arc} ${sweep} ${end_x} ${end_y}`;
    } else {
        flushPath(motif);
    }

    includeCircle(motif.bounds, center_x, center_y, radius);
    motif.x = end_x;
    motif.y = end_y;
    motif.heading = end_heading;
}

function addGenerator (program, name, matrix) {
    if (program.generators.some((generator) => generator.name === name)) {
        throw new PatternError(`generator ${name} is already defined`);
    }
    program.generators.push({name, matrix});
}

function addLattice (program, first_x, first_y, second_x, second_y, prefix = 'lattice') {
    addGenerator(program, `${prefix}_first`, translation(first_x, first_y));
    addGenerator(program, `${prefix}_second`, translation(second_x, second_y));
}

export function conwayOrbifoldGenerators (symbol, cell_size) {
    const cell = positiveNumber(String(cell_size), undefined, 'orbifold cell size');
    const square = [
        {name: 'east', matrix: translation(cell, 0)},
        {name: 'north', matrix: translation(0, cell)},
    ];
    const hex_height = Math.sqrt(3) * cell / 2;
    const hexagonal = [
        {name: 'east', matrix: translation(cell, 0)},
        {name: 'north_east', matrix: translation(cell/2, hex_height)},
    ];

    switch (symbol) {
    case 'o':
        return square;
    case '2222':
        return [...square, {name: 'half_turn', matrix: rotation(180)}];
    case '442':
        return [...square, {name: 'quarter_turn', matrix: rotation(90)}];
    case '*442':
        return [
            ...square,
            {name: 'quarter_turn', matrix: rotation(90)},
            {name: 'mirror', matrix: reflection(0, 0, 1, 0)},
        ];
    case '333':
        return [...hexagonal, {name: 'third_turn', matrix: rotation(120)}];
    case '*333':
        return [
            ...hexagonal,
            {name: 'third_turn', matrix: rotation(120)},
            {name: 'mirror', matrix: reflection(0, 0, 1, 0)},
        ];
    case '632':
        return [...hexagonal, {name: 'sixth_turn', matrix: rotation(60)}];
    case '*632':
        return [
            ...hexagonal,
            {name: 'sixth_turn', matrix: rotation(60)},
            {name: 'mirror', matrix: reflection(0, 0, 1, 0)},
        ];
    default:
        throw new PatternError(
            `orbifold ${symbol} is not shorthand yet; use explicit generator commands`
        );
    }
}

function parseMotifCommand (motif, words, line_number) {
    const command = words[0];

    switch (command) {
    case 'move':
    case 'jump': {
        if (words.length !== 3) {
            throw new PatternError(`${command} expects x y`, line_number);
        }
        const x = number(words[1], line_number, 'x');
        const y = number(words[2], line_number, 'y');
        flushPath(motif);
        motif.x = x;
        motif.y = y;
        includePoint(motif.bounds, x, y);
        return;
    }
    case 'line': {
        if (words.length !== 3) {
            throw new PatternError('line expects x y', line_number);
        }
        moveTurtle(
            motif,
            number(words[1], line_number, 'x'),
            number(words[2], line_number, 'y'),
            motif.pen_down
        );
        return;
    }
    case 'segment': {
        if (words.length !== 5) {
            throw new PatternError('segment expects x1 y1 x2 y2', line_number);
        }
        flushPath(motif);
        const x1 = number(words[1], line_number, 'x1');
        const y1 = number(words[2], line_number, 'y1');
        const x2 = number(words[3], line_number, 'x2');
        const y2 = number(words[4], line_number, 'y2');
        motif.shapes.push({
            kind: 'path',
            d: `M ${x1} ${y1} L ${x2} ${y2}`,
            ...styleCopy(motif.style),
        });
        includePoint(motif.bounds, x1, y1);
        includePoint(motif.bounds, x2, y2);
        motif.x = x2;
        motif.y = y2;
        return;
    }
    case 'forward': {
        if (words.length !== 2) {
            throw new PatternError('forward expects a distance', line_number);
        }
        const distance = number(words[1], line_number, 'distance');
        const radians = motif.heading * Math.PI / 180;
        moveTurtle(
            motif,
            motif.x + distance * Math.cos(radians),
            motif.y + distance * Math.sin(radians),
            motif.pen_down
        );
        return;
    }
    case 'left':
    case 'right': {
        if (words.length !== 2) {
            throw new PatternError(`${command} expects degrees`, line_number);
        }
        const degrees = number(words[1], line_number, 'degrees');
        motif.heading += (command === 'left' ? degrees : -degrees);
        return;
    }
    case 'heading': {
        if (words.length !== 2) {
            throw new PatternError('heading expects degrees', line_number);
        }
        motif.heading = number(words[1], line_number, 'degrees');
        return;
    }
    case 'arc_left':
    case 'arc_right': {
        if (words.length !== 3) {
            throw new PatternError(`${command} expects radius degrees`, line_number);
        }
        arcTurtle(
            motif,
            command === 'arc_left' ? 'left' : 'right',
            positiveNumber(words[1], line_number, 'radius'),
            number(words[2], line_number, 'degrees')
        );
        return;
    }
    case 'circle': {
        if (words.length !== 4) {
            throw new PatternError('circle expects x y radius', line_number);
        }
        flushPath(motif);
        const x = number(words[1], line_number, 'x');
        const y = number(words[2], line_number, 'y');
        const radius = positiveNumber(words[3], line_number, 'radius');
        motif.shapes.push({
            kind: 'circle',
            x, y, radius,
            ...styleCopy(motif.style),
        });
        includeCircle(motif.bounds, x, y, radius);
        return;
    }
    case 'close':
        ensurePathAtCurrentPoint(motif);
        motif.path += ' Z';
        flushPath(motif);
        return;
    case 'pen_up':
        if (words.length !== 1) {
            throw new PatternError('pen_up takes no arguments', line_number);
        }
        motif.pen_down = false;
        flushPath(motif);
        return;
    case 'pen_down':
        if (words.length !== 1) {
            throw new PatternError('pen_down takes no arguments', line_number);
        }
        motif.pen_down = true;
        return;
    case 'stroke':
        if (words.length !== 3) {
            throw new PatternError('stroke expects color width', line_number);
        }
        flushPath(motif);
        motif.style.stroke = words[1];
        motif.style.stroke_width = positiveNumber(words[2], line_number, 'stroke width');
        return;
    case 'fill':
        if (words.length !== 2) {
            throw new PatternError('fill expects a color or none', line_number);
        }
        flushPath(motif);
        motif.style.fill = words[1];
        return;
    default:
        throw new PatternError(`unknown motif command ${command}`, line_number);
    }
}

export function parsePattern (source) {
    const program = {
        version: 1,
        canvas: {width: 720, height: 720},
        viewport: {min_x: -360, min_y: -360, max_x: 360, max_y: 360},
        background: '#ffffff',
        style: {stroke: '#20252a', stroke_width: 2, fill: 'none'},
        motifs: {},
        generators: [],
        drawings: [],
    };

    let motif = null;
    const lines = source.split(/\r?\n/);

    lines.forEach((line, zero_based_line_number) => {
        const line_number = zero_based_line_number + 1;
        const words = wordsOnLine(line);
        if (words.length === 0) {
            return;
        }

        if (motif != null) {
            if (words[0] === 'end') {
                if (words.length !== 1) {
                    throw new PatternError('end takes no arguments', line_number);
                }
                flushPath(motif);
                motif.bounds = normalizedBounds(motif.bounds);
                program.motifs[motif.name] = {
                    name: motif.name,
                    shapes: motif.shapes,
                    bounds: motif.bounds,
                };
                motif = null;
                return;
            }

            parseMotifCommand(motif, words, line_number);
            return;
        }

        const command = words[0];
        switch (command) {
        case 'canvas':
            if (words.length !== 3) {
                throw new PatternError('canvas expects width height', line_number);
            }
            program.canvas.width = positiveNumber(words[1], line_number, 'canvas width');
            program.canvas.height = positiveNumber(words[2], line_number, 'canvas height');
            break;
        case 'viewport':
            if (words.length !== 5) {
                throw new PatternError('viewport expects min_x min_y max_x max_y', line_number);
            }
            program.viewport = {
                min_x: number(words[1], line_number, 'min_x'),
                min_y: number(words[2], line_number, 'min_y'),
                max_x: number(words[3], line_number, 'max_x'),
                max_y: number(words[4], line_number, 'max_y'),
            };
            if (program.viewport.max_x <= program.viewport.min_x ||
                program.viewport.max_y <= program.viewport.min_y) {
                throw new PatternError('viewport maxima must be greater than minima', line_number);
            }
            break;
        case 'background':
            if (words.length !== 2) {
                throw new PatternError('background expects a color', line_number);
            }
            program.background = words[1];
            break;
        case 'stroke':
            if (words.length !== 3) {
                throw new PatternError('stroke expects color width', line_number);
            }
            program.style.stroke = words[1];
            program.style.stroke_width = positiveNumber(words[2], line_number, 'stroke width');
            break;
        case 'fill':
            if (words.length !== 2) {
                throw new PatternError('fill expects a color or none', line_number);
            }
            program.style.fill = words[1];
            break;
        case 'motif': {
            if (words.length !== 2) {
                throw new PatternError('motif expects a name', line_number);
            }
            const name = words[1];
            if (program.motifs[name] != undefined) {
                throw new PatternError(`motif ${name} is already defined`, line_number);
            }
            motif = newMotifState(name, program.style);
            break;
        }
        case 'lattice':
            if (words.length !== 5) {
                throw new PatternError('lattice expects first_x first_y second_x second_y', line_number);
            }
            try {
                addLattice(
                    program,
                    number(words[1], line_number, 'first_x'),
                    number(words[2], line_number, 'first_y'),
                    number(words[3], line_number, 'second_x'),
                    number(words[4], line_number, 'second_y')
                );
            } catch (error) {
                if (error instanceof PatternError) {
                    throw new PatternError(error.message, line_number);
                }
                throw error;
            }
            break;
        case 'generator': {
            if (words.length < 4) {
                throw new PatternError('generator expects name and transform', line_number);
            }
            const name = words[1];
            const kind = words[2];
            let matrix;
            if (kind === 'translate') {
                if (words.length !== 5) {
                    throw new PatternError('translate generator expects dx dy', line_number);
                }
                matrix = translation(
                    number(words[3], line_number, 'dx'),
                    number(words[4], line_number, 'dy')
                );
            } else if (kind === 'rotate') {
                if (words.length !== 4 && words.length !== 6) {
                    throw new PatternError('rotate generator expects degrees [center_x center_y]', line_number);
                }
                matrix = rotation(
                    number(words[3], line_number, 'degrees'),
                    words.length === 6 ? number(words[4], line_number, 'center_x') : 0,
                    words.length === 6 ? number(words[5], line_number, 'center_y') : 0
                );
            } else if (kind === 'reflect') {
                if (words.length !== 7) {
                    throw new PatternError('reflect generator expects x1 y1 x2 y2', line_number);
                }
                matrix = reflection(
                    number(words[3], line_number, 'x1'),
                    number(words[4], line_number, 'y1'),
                    number(words[5], line_number, 'x2'),
                    number(words[6], line_number, 'y2')
                );
            } else if (kind === 'glide') {
                if (words.length !== 8) {
                    throw new PatternError('glide generator expects x1 y1 x2 y2 distance', line_number);
                }
                matrix = glideReflection(
                    number(words[3], line_number, 'x1'),
                    number(words[4], line_number, 'y1'),
                    number(words[5], line_number, 'x2'),
                    number(words[6], line_number, 'y2'),
                    number(words[7], line_number, 'distance')
                );
            } else {
                throw new PatternError(`unknown generator transform ${kind}`, line_number);
            }
            try {
                addGenerator(program, name, matrix);
            } catch (error) {
                if (error instanceof PatternError) {
                    throw new PatternError(error.message, line_number);
                }
                throw error;
            }
            break;
        }
        case 'orbifold': {
            if (words.length !== 3) {
                throw new PatternError('orbifold expects Conway_symbol cell_size', line_number);
            }
            const symbol = words[1];
            if (program.generators.length !== 0) {
                throw new PatternError(
                    'orbifold shorthand must appear before explicit lattice/generator commands',
                    line_number
                );
            }
            let generators;
            try {
                generators = conwayOrbifoldGenerators(
                    symbol,
                    positiveNumber(words[2], line_number, 'cell size')
                );
            } catch (error) {
                if (error instanceof PatternError) {
                    throw new PatternError(error.message, line_number);
                }
                throw error;
            }
            generators.forEach((generator) => addGenerator(program, generator.name, generator.matrix));
            break;
        }
        case 'draw':
            if (words.length !== 2) {
                throw new PatternError('draw expects a motif name', line_number);
            }
            program.drawings.push({motif: words[1], orbit: false, limit: 1});
            break;
        case 'orbit':
            if (words.length !== 2 && words.length !== 3) {
                throw new PatternError('orbit expects motif_name [element_limit]', line_number);
            }
            program.drawings.push({
                motif: words[1],
                orbit: true,
                limit: words.length === 3
                    ? integer(words[2], line_number, 'element limit')
                    : DEFAULT_ORBIT_LIMIT,
            });
            if (program.drawings[program.drawings.length - 1].limit <= 0) {
                throw new PatternError('element limit must be positive', line_number);
            }
            break;
        default:
            throw new PatternError(`unknown command ${command}`, line_number);
        }
    });

    if (motif != null) {
        throw new PatternError(`motif ${motif.name} is missing end`);
    }

    program.drawings.forEach((drawing) => {
        if (program.motifs[drawing.motif] == undefined) {
            throw new PatternError(`drawing refers to unknown motif ${drawing.motif}`);
        }
    });

    return program;
}

function transformPoint (matrix, x, y) {
    const [a, b, c, d, e, f] = matrix;
    return {x: a*x + c*y + e, y: b*x + d*y + f};
}

function transformedBounds (bounds, matrix) {
    const corners = [
        transformPoint(matrix, bounds.min_x, bounds.min_y),
        transformPoint(matrix, bounds.min_x, bounds.max_y),
        transformPoint(matrix, bounds.max_x, bounds.min_y),
        transformPoint(matrix, bounds.max_x, bounds.max_y),
    ];
    const result = emptyBounds();
    corners.forEach(({x, y}) => includePoint(result, x, y));
    return normalizedBounds(result);
}

function boundsIntersect (first, second) {
    return first.max_x >= second.min_x &&
           first.min_x <= second.max_x &&
           first.max_y >= second.min_y &&
           first.min_y <= second.max_y;
}

function expandedViewport (viewport) {
    const width = viewport.max_x - viewport.min_x;
    const height = viewport.max_y - viewport.min_y;
    const padding = Math.max(width, height);
    return {
        min_x: viewport.min_x - padding,
        min_y: viewport.min_y - padding,
        max_x: viewport.max_x + padding,
        max_y: viewport.max_y + padding,
    };
}

function transformKey (matrix) {
    return matrix
        .map((entry) => Math.round(entry / EPSILON) * EPSILON)
        .map((entry) => Object.is(entry, -0) ? 0 : entry)
        .join(',');
}

export function enumerateGroup (program, motif_name, element_limit = DEFAULT_ORBIT_LIMIT) {
    const motif = program.motifs[motif_name];
    if (motif == undefined) {
        throw new PatternError(`unknown motif ${motif_name}`);
    }
    if (program.generators.length === 0) {
        return [identityTransform()];
    }

    const moves = [];
    program.generators.forEach((generator) => {
        moves.push(generator.matrix);
        moves.push(inverseTransform(generator.matrix));
    });

    const viewport = program.viewport;
    const exploration_viewport = expandedViewport(viewport);
    const queue = [identityTransform()];
    const seen = new Set();
    const visible = [];

    while (queue.length !== 0 && seen.size < element_limit) {
        const current = queue.shift();
        const key = transformKey(current);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const current_bounds = transformedBounds(motif.bounds, current);
        if (boundsIntersect(current_bounds, viewport)) {
            visible.push(current);
        }

        moves.forEach((move) => {
            const next = composeTransforms(current, move);
            const next_key = transformKey(next);
            if (!seen.has(next_key) &&
                boundsIntersect(transformedBounds(motif.bounds, next), exploration_viewport)) {
                queue.push(next);
            }
        });
    }

    return visible;
}

function svgElement (name) {
    return document.createElementNS(SVG_NS, name);
}

function applyStyle (element, shape) {
    element.setAttribute('stroke', shape.stroke);
    element.setAttribute('stroke-width', String(shape.stroke_width));
    element.setAttribute('fill', shape.fill);
    element.setAttribute('stroke-linecap', 'round');
    element.setAttribute('stroke-linejoin', 'round');
    element.setAttribute('vector-effect', 'non-scaling-stroke');
}

function matrixAttribute (matrix) {
    return `matrix(${matrix.map((entry) => Number(entry.toFixed(10))).join(' ')})`;
}

function safeIdentifier (name, index) {
    return `pattern-motif-${index}-${name.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

export function renderPattern (program, svg) {
    if (svg == null || String(svg.namespaceURI) !== SVG_NS || svg.localName !== 'svg') {
        throw new PatternError('renderPattern needs an SVG element');
    }

    while (svg.firstChild != null) {
        svg.removeChild(svg.firstChild);
    }

    const {min_x, min_y, max_x, max_y} = program.viewport;
    const view_width = max_x - min_x;
    const view_height = max_y - min_y;
    svg.setAttribute('width', String(program.canvas.width));
    svg.setAttribute('height', String(program.canvas.height));
    svg.setAttribute('viewBox', `${min_x} ${min_y} ${view_width} ${view_height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const background = svgElement('rect');
    background.setAttribute('x', String(min_x));
    background.setAttribute('y', String(min_y));
    background.setAttribute('width', String(view_width));
    background.setAttribute('height', String(view_height));
    background.setAttribute('fill', program.background);
    svg.appendChild(background);

    const definitions = svgElement('defs');
    const motif_ids = {};
    Object.values(program.motifs).forEach((motif, index) => {
        const group = svgElement('g');
        const id = safeIdentifier(motif.name, index);
        motif_ids[motif.name] = id;
        group.setAttribute('id', id);

        motif.shapes.forEach((shape) => {
            let element;
            if (shape.kind === 'path') {
                element = svgElement('path');
                element.setAttribute('d', shape.d);
            } else if (shape.kind === 'circle') {
                element = svgElement('circle');
                element.setAttribute('cx', String(shape.x));
                element.setAttribute('cy', String(shape.y));
                element.setAttribute('r', String(shape.radius));
            } else {
                throw new PatternError(`renderer does not know shape kind ${shape.kind}`);
            }
            applyStyle(element, shape);
            group.appendChild(element);
        });

        definitions.appendChild(group);
    });
    svg.appendChild(definitions);

    // Pattern coordinates are mathematical (positive y goes up).  SVG is
    // screen-oriented (positive y goes down), so flip the entire drawing.
    const content = svgElement('g');
    content.setAttribute('transform', `matrix(1 0 0 -1 0 ${min_y + max_y})`);
    svg.appendChild(content);

    let instances = 0;
    program.drawings.forEach((drawing) => {
        const matrices = drawing.orbit
            ? enumerateGroup(program, drawing.motif, drawing.limit)
            : [identityTransform()];
        matrices.forEach((matrix) => {
            const use = svgElement('use');
            const reference = `#${motif_ids[drawing.motif]}`;
            use.setAttribute('href', reference);
            use.setAttributeNS(XLINK_NS, 'xlink:href', reference);
            use.setAttribute('transform', matrixAttribute(matrix));
            content.appendChild(use);
            instances += 1;
        });
    });

    return {instances, motifs: Object.keys(program.motifs).length};
}
