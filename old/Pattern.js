import {parsePattern, renderPattern} from './js/PatternLanguage.js';
import {
    groupFromGroupExplorerData,
    patternSourceForGroup,
    planarActionForGroup,
} from './js/GroupPattern.js';

const source = document.querySelector('#source');
const preview = document.querySelector('#pattern');
const status = document.querySelector('#status');
const example = document.querySelector('#example');
const render_button = document.querySelector('#render');
const heading = document.querySelector('#pattern-heading');

const example_files = {
    'conway-442': './patterns/conway-442.pattern',
    'calegari-tracks': './patterns/calegari-tracks.pattern',
};

let render_timer;
let source_label = '';
let selected_group_source = null;

function render () {
    clearTimeout(render_timer);
    try {
        const program = parsePattern(source.value);
        const statistics = renderPattern(program, preview);
        status.classList.remove('error');
        status.textContent =
            (source_label === '' ? '' : `${source_label} · `) +
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
    if (name === 'selected-group') {
        if (selected_group_source == null) {
            throw new Error('No selected group pattern is loaded');
        }
        source.value = selected_group_source;
        render();
        return;
    }

    const response = await fetch(example_files[name]);
    if (!response.ok) {
        throw new Error(`Could not load ${example_files[name]} (${response.status})`);
    }
    source_label = '';
    heading.textContent = 'Pattern Language';
    source.value = await response.text();
    render();
}

async function loadSelectedGroup () {
    const page_url = new URL(window.location.href);
    const group_parameter = page_url.searchParams.get('groupURL');
    if (group_parameter == null) {
        return false;
    }

    const group_url = new URL(group_parameter, window.location.href);
    const response = await fetch(group_url);
    if (!response.ok) {
        throw new Error(`Could not load selected group (${response.status})`);
    }

    const group = groupFromGroupExplorerData(await response.text(), group_url.pathname.split('/').pop());
    const action = planarActionForGroup(group);
    if (action == null) {
        patternSourceForGroup(group); // throws the more useful mathematical explanation
    }

    selected_group_source = patternSourceForGroup(group);
    source_label = `${group.shortName} · ${action.kind} action`;
    heading.textContent = `Pattern · ${group.shortName}`;

    const selected_option = document.createElement('option');
    selected_option.value = 'selected-group';
    selected_option.textContent = `Selected group: ${group.shortName}`;
    example.prepend(selected_option);
    example.value = selected_option.value;
    source.value = selected_group_source;
    render();
    return true;
}

function reportError (error) {
    status.classList.add('error');
    status.textContent = error instanceof Error ? error.message : String(error);
}

source.addEventListener('input', renderSoon);
render_button.addEventListener('click', render);
example.addEventListener('change', () => {
    if (example.value !== 'selected-group') {
        source_label = '';
    }
    loadExample(example.value).catch(reportError);
});

loadSelectedGroup()
    .then((loaded) => loaded ? undefined : loadExample(example.value))
    .catch(reportError);
