import GroupURLs from './GroupURLs.js';
import * as Library from './js/Library.js';
import {createUnlabelledCayleyDiagramView} from './js/CayleyDiagramView.js';
import {createMinimalMulttableView} from './js/MulttableView.js';

const cayley_slot = document.querySelector('#cayley');
const table_slot = document.querySelector('#multtable');
const again_button = document.querySelector('#again');
const error_box = document.querySelector('#error');

function randomURL () {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return GroupURLs.urls[bytes[0] % GroupURLs.urls.length];
}

function displaySize () {
    return Math.min(512, Math.max(280, Math.floor(window.innerWidth)));
}

function showError (error) {
    error_box.textContent = error instanceof Error ? error.stack || error.message : String(error);
    error_box.style.display = 'block';
}

async function showRandomGroup () {
    again_button.disabled = true;
    error_box.style.display = 'none';
    cayley_slot.replaceChildren();
    table_slot.replaceChildren();

    try {
        // Load exactly one bundled .group file.  Do not enumerate or render the library.
        const group = await Library.getGroupOrDownload(randomURL());
        const size = displaySize();

        // First useful visual: the Cayley diagram.
        const cayley_view = createUnlabelledCayleyDiagramView({width: size, height: size});
        const cayley_title = group.cayleyDiagrams.length === 0 ? undefined : group.cayleyDiagrams[0].name;
        cayley_view.setDiagram(group, cayley_title);
        const cayley_image = cayley_view.getImage();
        cayley_image.alt = 'Cayley diagram';
        cayley_slot.replaceChildren(cayley_image);

        // Give the browser a paint opportunity before doing the multiplication table.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const table_view = createMinimalMulttableView({width: size, height: size});
        table_view.group = group;
        const table_image = table_view.getImage();
        table_image.alt = 'Multiplication table';
        table_slot.replaceChildren(table_image);
    } catch (error) {
        showError(error);
    } finally {
        again_button.disabled = false;
    }
}

again_button.addEventListener('click', showRandomGroup);
showRandomGroup();
