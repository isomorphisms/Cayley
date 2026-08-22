// @flow

function integerList (text /*: string */) /*: Array<number> */ {
  const trimmed = text.trim()
  return trimmed === '' ? [] : trimmed.split(/\s+/).map(Number)
}

function section (text /*: string */, tag /*: string */) /*: ?string */ {
  const match = text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match == null ? undefined : match[1]
}

function attribute (tag /*: string */, name /*: string */) /*: ?string */ {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return match == null ? undefined : match[1]
}

function rowSources (text /*: string */) /*: Array<string> */ {
  const source = section(text, 'multtable')
  if (source == null) {
    throw new Error('group file has no multiplication table')
  }

  return Array.from(
    source.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/gi),
    (match) => match[1]
  )
}

function parseGenerators (text /*: string */) /*: Array<number> */ {
  const match = text.match(/<generators\b[^>]*>/i)
  if (match == null) return []
  const list = attribute(match[0], 'list')
  return list == null ? [] : integerList(list)
}

export default class MobileGroup {
  /*::
  order: number;
  elements: Array<number>;
  _row_sources: Array<string>;
  _rows: Array<void | Array<number>>;
  _generators: Array<number>;
  */

  constructor (text /*: string */) {
    this._row_sources = rowSources(text)
    this.order = this._row_sources.length

    if (this.order === 0) {
      throw new Error('group file has an empty multiplication table')
    }

    this.elements = Array.from({length: this.order}, (_, inx) => inx)
    this._rows = new Array(this.order)
    this._generators = parseGenerators(text)
  }

  row (index /*: number */) /*: Array<number> */ {
    const normalized = index % this.order
    let row = this._rows[normalized]

    if (row == null) {
      row = integerList(this._row_sources[normalized])
      if (row.length !== this.order) {
        throw new Error(`group file has malformed multiplication row ${normalized}`)
      }
      this._rows[normalized] = row
    }

    return row
  }

  mult (left /*: number */, right /*: number */) /*: number */ {
    return this.row(left)[right % this.order]
  }

  get generators () /*: Array<Array<number>> */ {
    if (this._generators.length === 0 && this.order > 1) {
      this._generators = this.findGenerators()
    }
    return [this._generators]
  }

  closure (generators /*: Array<number> */) /*: Set<number> */ {
    const seen = new Set([0])
    const queue = [0]

    while (queue.length !== 0) {
      const element = queue.shift()
      if (element == null) continue

      generators.forEach((generator) => {
        const product = this.mult(generator, element)
        if (!seen.has(product)) {
          seen.add(product)
          queue.push(product)
        }
      })
    }

    return seen
  }

  findGenerators () /*: Array<number> */ {
    const generators = []
    let generated = new Set([0])

    for (const element of this.elements.slice(1)) {
      if (!generated.has(element)) {
        generators.push(element)
        generated = this.closure(generators)
        if (generated.size === this.order) break
      }
    }

    return generators
  }
}
