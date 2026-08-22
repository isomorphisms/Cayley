import {parsePattern, renderPattern} from './js/PatternLanguage.js';

const source = document.querySelector('#source');
const preview = document.querySelector('#pattern');
const status = document.querySelector('#status');
const example = document.querySelector('#example');
const render_button = document.querySelector('#render');

const example_files = {
    'conway-442': './patterns/conway-442.pattern',
    'calegari-tracks': './patterns/calegari-tracks.pattern',
};

let render_timer;

function render () {
    clearTimeout(render_timer);
    try {
        const program = parsePattern(source.value);
        const statistics = renderPattern(program, preview);
        status.classList.remove('error');
        status.textContent =
            `${statistics.instances} visible copies · ${statistics.motifs} motif` +
            (statistics.motifs === 1 ? '' : 's');
    } catch (error) {
        status.classList.add('error');
        status.textContent = error instanceof Error ? error.message : String(error);
    }
}

function renderSoon () {
    clearTimeout(render_timer);
    render_timer = setTimeout(render, 90);
}

async function loadExample (name) {
    const response = await fetch(example_files[name]);
    if (!response.ok) {
        throw new Error(`Could not load ${example_files[name]} (${response.status})`);
    }
    source.value = await response.text();
    render();
}

source.addEventListener('input', renderSoon);
render_button.addEventListener('click', render);
example.addEventListener('change', () => {
    loadExample(example.value).catch((error) => {
        status.classList.add('error');
        status.textContent = error.message;
    });
});

loadExample(example.value).catch((error) => {
    status.classList.add('error');
    status.textContent = error.message;
});
