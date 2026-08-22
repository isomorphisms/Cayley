import GroupURLs from './GroupURLs.js'
import MobileGroup from './MobileGroup.js'

const cayley_slot = document.querySelector('#cayley')
const table_slot = document.querySelector('#multtable')
const again_button = document.querySelector('#again')
const error_box = document.querySelector('#error')

function randomURL () {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return GroupURLs.urls[bytes[0] % GroupURLs.urls.length]
}

function displaySize () {
  return Math.min(512, Math.max(280, Math.floor(window.innerWidth)))
}

function showError (error) {
  error_box.textContent = error instanceof Error ? error.stack || error.message : String(error)
  error_box.style.display = 'block'
}

async function loadGroup (url) {
  const response = await fetch(url, {cache: 'no-store'})
  if (!response.ok) {
    throw new Error(`Error loading ${url}: HTTP ${response.status}`)
  }
  return new MobileGroup(await response.text())
}

function positionsOnCircle (order, size) {
  if (order === 1) {
    return [{x: size / 2, y: size / 2}]
  }

  const center = size / 2
  const radius = size * 0.41
  return Array.from({length: order}, (_, element) => {
    const angle = -Math.PI / 2 + 2 * Math.PI * element / order
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    }
  })
}

function drawArrowhead (context, start, end, node_radius) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return

  const ux = dx / length
  const uy = dy / length
  const tip = {
    x: end.x - ux * node_radius,
    y: end.y - uy * node_radius
  }
  const arrow_length = Math.max(5, node_radius * 1.15)
  const arrow_width = arrow_length * 0.55
  const base_x = tip.x - ux * arrow_length
  const base_y = tip.y - uy * arrow_length

  context.beginPath()
  context.moveTo(tip.x, tip.y)
  context.lineTo(base_x - uy * arrow_width, base_y + ux * arrow_width)
  context.lineTo(base_x + uy * arrow_width, base_y - ux * arrow_width)
  context.closePath()
  context.fill()
}

function createCayleyCanvas (group, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Cayley diagram')

  const context = canvas.getContext('2d')
  const positions = positionsOnCircle(group.order, size)
  const node_radius = Math.max(3, Math.min(10, 34 / Math.sqrt(group.order)))
  const generators = group.generators[0]

  context.fillStyle = '#fff'
  context.fillRect(0, 0, size, size)
  context.lineWidth = Math.max(1, Math.min(3, 14 / Math.sqrt(group.order)))

  generators.forEach((generator, generator_index) => {
    const involution = group.mult(generator, generator) === 0
    context.strokeStyle = `hsl(${Math.round(360 * generator_index / Math.max(1, generators.length))}, 72%, 42%)`
    context.fillStyle = context.strokeStyle

    group.elements.forEach((element) => {
      const product = group.mult(generator, element)
      if (product === element || (involution && element > product)) return

      const start = positions[element]
      const end = positions[product]
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()

      if (!involution) {
        drawArrowhead(context, start, end, node_radius)
      }
    })
  })

  context.lineWidth = 1.5
  group.elements.forEach((element) => {
    const point = positions[element]
    context.beginPath()
    context.arc(point.x, point.y, node_radius, 0, 2 * Math.PI)
    context.fillStyle = element === 0 ? '#222' : '#fff'
    context.fill()
    context.strokeStyle = '#222'
    context.stroke()
  })

  return canvas
}

function afterPaint () {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

async function showRandomGroup () {
  again_button.disabled = true
  error_box.style.display = 'none'
  cayley_slot.replaceChildren()
  table_slot.replaceChildren()

  try {
    // Fetch one bundled file; numeric row parsing stays lazy.
    const group = await loadGroup(randomURL())
    const size = displaySize()

    // Deliberately small first-paint renderer: no legacy model/view modules or table code.
    cayley_slot.replaceChildren(createCayleyCanvas(group, size))

    // Do not build the multiplication table until the Cayley diagram has reached a paint.
    await afterPaint()
    const {createMulttableCanvas} = await import('./MobileTable.js')
    table_slot.replaceChildren(createMulttableCanvas(group, size))
  } catch (error) {
    showError(error)
  } finally {
    again_button.disabled = false
  }
}

again_button.addEventListener('click', showRandomGroup)
showRandomGroup()
