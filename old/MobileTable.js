export function createMulttableCanvas (group, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Multiplication table')

  const context = canvas.getContext('2d')
  const edge = (index) => Math.round(size * index / group.order)
  const colors = group.elements.map(
    (element) => `hsl(${Math.round(360 * element / group.order)}, 70%, 68%)`
  )

  for (let row = 0; row < group.order; row++) {
    for (let column = 0; column < group.order; column++) {
      const left = edge(column)
      const top = edge(row)
      const right = edge(column + 1)
      const bottom = edge(row + 1)
      context.fillStyle = colors[group.mult(row, column)]
      context.fillRect(left, top, right - left, bottom - top)
    }
  }

  return canvas
}
