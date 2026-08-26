import { describe, it, expect } from 'vitest'
import { searchBoxColourVars } from './SiteSearchBlock'
import { searchCss } from '../public/search-css'

// A box that has never been coloured must emit no style attribute at all, and
// the two narrow text colours (placeholder, typed) must win over the broad
// "field text" one without disturbing a box that only ever set that.

describe('searchBoxColourVars', () => {
  it('emits nothing when no colour is set', () => {
    expect(searchBoxColourVars({})).toBeUndefined()
    expect(searchBoxColourVars({ boxBg: '  ', boxPlaceholder: '' })).toBeUndefined()
  })

  it('maps each field to its own custom property', () => {
    expect(searchBoxColourVars({
      boxBg: 'var(--color-1)',
      boxBorder: 'var(--color-2)',
      boxText: 'var(--color-3)',
      boxPlaceholder: 'light-dark(#777, #aaa)',
      boxTyped: '#111',
    })).toEqual({
      '--srch-bg': 'var(--color-1)',
      '--srch-border': 'var(--color-2)',
      '--srch-fg': 'var(--color-3)',
      '--srch-placeholder': 'light-dark(#777, #aaa)',
      '--srch-typed': '#111',
    })
  })

  it('carries only the colours that were picked', () => {
    expect(searchBoxColourVars({ boxPlaceholder: '#777' })).toEqual({ '--srch-placeholder': '#777' })
  })
})

describe('search field text CSS', () => {
  const css = searchCss()

  it('falls placeholder and typed colour back through --srch-fg to their old tokens', () => {
    expect(css).toContain('.srch-input::placeholder{color:var(--srch-placeholder,var(--srch-fg,var(--color-text-muted)))}')
    expect(css).toContain('color:var(--srch-typed,inherit)')
    expect(css).toContain('.srch-input-static{white-space:nowrap;overflow:hidden;color:var(--srch-placeholder,var(--srch-fg,var(--color-text-muted)))}')
    expect(css).toContain('.srch-input-static.srch-input-typed{color:var(--srch-typed,var(--srch-fg,var(--color-text)))}')
  })
})
