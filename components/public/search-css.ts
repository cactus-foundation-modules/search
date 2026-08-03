// All search chrome CSS, emitted as an injected <style> by the components that
// need it (never a core globals.css edit - the stylesheet travels with the
// block). Semantic tokens only; class prefix srch-.

// The three sizes as bare declarations rather than only as finished rules: the
// Size field is per-breakpoint, and a box set to (say) Medium on desktop and
// Small on phones needs the same values again inside a media query scoped to
// that one box. Exported so there is one place to change a size, not two.
export const SRCH_SIZE_VARS: Record<'small' | 'medium' | 'large', string> = {
  small: '--srch-pad:.375rem .625rem;--srch-font:.8125rem;--srch-icon:14px',
  medium: '--srch-pad:.5rem .75rem;--srch-font:.9375rem;--srch-icon:16px',
  large: '--srch-pad:.75rem 1rem;--srch-font:1.0625rem;--srch-icon:18px',
}

export function searchCss(): string {
  return `
.srch-box{position:relative;font-family:inherit}
.srch-box.srch-align-centre{margin-left:auto;margin-right:auto}
.srch-box.srch-align-right{margin-left:auto}

.srch-size-small{${SRCH_SIZE_VARS.small}}
.srch-size-medium{${SRCH_SIZE_VARS.medium}}
.srch-size-large{${SRCH_SIZE_VARS.large}}
.srch-corner-square{--srch-radius:0}
.srch-corner-rounded{--srch-radius:8px}
.srch-corner-pill{--srch-radius:999px}
.srch-accent-primary{--srch-accent:var(--color-primary)}
.srch-accent-link{--srch-accent:var(--color-link)}
.srch-accent-neutral{--srch-accent:var(--color-border-strong)}

.srch-input-wrap{display:flex;align-items:center;gap:.5rem;margin:0;padding:var(--srch-pad);border-radius:var(--srch-radius);font:inherit;font-size:var(--srch-font);background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text)}
.srch-style-filled .srch-input-wrap{background:var(--color-bg-subtle);border-color:transparent}
.srch-style-minimal .srch-input-wrap{background:transparent;border-color:transparent;border-bottom:1px solid var(--color-border)}
.srch-input-wrap:focus-within{border-color:var(--srch-accent);outline:2px solid color-mix(in srgb,var(--srch-accent) 30%,transparent);outline-offset:1px}
.srch-input{display:block;flex:1;min-width:0;border:none;outline:none;background:transparent;font:inherit;color:inherit;height:1.5em;line-height:1.5;margin:0;padding:0;appearance:none;-webkit-appearance:none;text-align:left}
.srch-input::-webkit-search-decoration,.srch-input::-webkit-search-cancel-button{-webkit-appearance:none}
.srch-input::placeholder{color:var(--color-text-muted)}
.srch-iconsvg{width:var(--srch-icon);height:var(--srch-icon);flex:none;color:var(--color-text-muted)}
.srch-btn{flex:none;border:none;cursor:pointer;font:inherit;padding:.375rem .875rem;border-radius:calc(var(--srch-radius) - 2px);background:var(--srch-accent);color:var(--color-on-primary)}
.srch-btn:hover{filter:brightness(1.08)}
.srch-iconbtn{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text);cursor:pointer;font:inherit;padding:var(--srch-pad);border-radius:var(--srch-radius)}
.srch-iconbtn:hover{border-color:var(--srch-accent)}
/* Field style applies to the icon button too, so a magnifier standing in a row
   of bare header icons can drop its box: 'minimal' strips the border, the fill
   and the padding (leaving the glyph alone at its --srch-icon size), 'filled'
   keeps a soft chip. 'outlined' is the default and is untouched. */
.srch-style-filled .srch-iconbtn{background:var(--color-bg-subtle);border-color:transparent}
/* border:none, not a transparent border: a 1px transparent edge still measures,
   so the button came out 2px bigger than the glyph and would never line up with
   the bare icons either side of it. */
.srch-style-minimal .srch-iconbtn{background:transparent;border:none;padding:0;border-radius:0}
.srch-style-minimal .srch-iconbtn .srch-iconsvg{color:currentColor}
.srch-style-minimal .srch-iconbtn:hover{color:var(--srch-accent)}
/* The icon button is inline-flex, so in a plain block wrapper it sits on the
   text baseline with the line box's descender space below it - which rides the
   glyph 2-3px above the centre line of the icons beside it in a header row.
   Making the wrapper a flex box takes the baseline out of it entirely. */
.srch-box-icon{display:inline-flex;align-items:center;line-height:0}

.srch-dd{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:60;background:var(--color-surface-raised,var(--color-surface));border:1px solid var(--color-border);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.14);overflow:hidden;max-height:70vh;overflow-y:auto}
.srch-dd-viewport{left:50%;right:auto;margin-left:-50vw;width:100vw;border-radius:0;border-left:none;border-right:none}
.srch-dd-wide{left:50%;right:auto;transform:translateX(-50%);width:min(680px,92vw)}
.srch-dd-inner{padding:.375rem}
.srch-group-label{padding:.5rem .75rem .25rem;font-size:.6875rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted)}

.srch-row{display:grid;grid-template-columns:auto 1fr;gap:.625rem;align-items:center;padding:.5rem .625rem;border-radius:8px;text-decoration:none;color:var(--color-text)}
.srch-row.srch-active,.srch-row:hover{background:var(--color-bg-subtle)}
.srch-row-thumb{width:44px;height:44px;flex:none;border-radius:6px;overflow:hidden;background:var(--color-bg-subtle)}
.srch-row-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.srch-row-main{min-width:0}
.srch-row-title{font-size:.9375rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.srch-row-excerpt{font-size:.8125rem;color:var(--color-text-secondary);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.srch-row-meta{display:flex;gap:.5rem;align-items:center;margin-top:.125rem}
.srch-badge{display:inline-block;font-size:.625rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:.125rem .375rem;border-radius:4px;background:var(--color-bg-subtle);border:1px solid var(--color-border);color:var(--color-text-muted)}
.srch-price{font-size:.8125rem;font-weight:600;color:var(--color-text)}
.srch-price-was{font-size:.75rem;color:var(--color-text-muted);text-decoration:line-through;margin-left:.25rem}
mark.srch-mark{background:color-mix(in srgb,var(--srch-accent,var(--color-primary)) 22%,transparent);color:inherit;border-radius:2px;padding:0 1px}

.srch-cardgrid{display:grid;grid-template-columns:repeat(var(--srch-cols,3),minmax(0,1fr));gap:.75rem;padding:.5rem}
.srch-shopcards{padding:.5rem}
.srch-card{display:block;text-decoration:none;color:var(--color-text);border:1px solid var(--color-border);border-radius:10px;overflow:hidden;background:var(--color-surface)}
.srch-card:hover{border-color:var(--srch-accent,var(--color-primary))}
.srch-card-img{aspect-ratio:1/1;background:var(--color-bg-subtle)}
.srch-card-img img{width:100%;height:100%;object-fit:cover;display:block}
.srch-card-body{padding:.5rem .625rem .625rem}
.srch-card-name{font-size:.875rem;font-weight:500;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.srch-card-pricerow{margin-top:.25rem}

.srch-thumb-square .srch-row-thumb,.srch-thumb-square .srch-card-img{aspect-ratio:1/1}
.srch-thumb-landscape .srch-card-img{aspect-ratio:4/3}
.srch-thumb-landscape .srch-row-thumb{width:84px;height:63px}
.srch-thumb-circle .srch-row-thumb{border-radius:50%}
.srch-thumb-circle .srch-card-img{aspect-ratio:1/1;border-radius:50%;margin:.5rem .5rem 0;overflow:hidden}

.srch-empty{padding:1rem .75rem;text-align:center;color:var(--color-text-muted);font-size:.875rem}
.srch-viewall{display:block;padding:.625rem .75rem;text-align:center;font-size:.875rem;color:var(--srch-accent,var(--color-link));text-decoration:none;border-top:1px solid var(--color-border)}
.srch-viewall:hover{background:var(--color-bg-subtle)}

/* Results page */
.srch-results{max-width:100%}
.srch-res-heading{margin:0 0 .25rem}
.srch-res-count{color:var(--color-text-muted);font-size:.9375rem;margin:0 0 1rem}
.srch-tabs{display:flex;flex-wrap:wrap;gap:.375rem;margin:0 0 1rem}
.srch-tab{font-size:.8125rem;padding:.25rem .75rem;border-radius:999px;border:1px solid var(--color-border);color:var(--color-text-secondary);text-decoration:none}
.srch-tab:hover{border-color:var(--srch-accent,var(--color-primary))}
.srch-tab.srch-tab-active{background:var(--srch-accent,var(--color-primary));border-color:var(--srch-accent,var(--color-primary));color:var(--color-on-primary)}
.srch-sortrow{display:flex;justify-content:flex-end;gap:.5rem;margin:0 0 .75rem;font-size:.8125rem}
.srch-sortrow a{color:var(--color-text-secondary);text-decoration:none}
.srch-sortrow a.srch-sort-active{color:var(--color-text);font-weight:600}
.srch-list{display:flex;flex-direction:column;gap:.25rem}
.srch-list .srch-row-thumb{width:64px;height:64px}
.srch-list-compact .srch-row{padding:.25rem .5rem}
.srch-list-compact .srch-row-thumb{width:36px;height:36px}
.srch-grid{display:grid;grid-template-columns:repeat(var(--srch-cols,3),minmax(0,1fr));gap:1rem}
.srch-section{margin:0 0 1.5rem}
.srch-pagination{display:flex;flex-wrap:wrap;gap:.375rem;margin:1.5rem 0 0}
.srch-page-link{min-width:2rem;text-align:center;padding:.25rem .5rem;border-radius:6px;border:1px solid var(--color-border);color:var(--color-text-secondary);text-decoration:none;font-size:.875rem}
.srch-page-link.srch-page-active{background:var(--srch-accent,var(--color-primary));border-color:var(--srch-accent,var(--color-primary));color:var(--color-on-primary)}
.srch-loadmore{display:block;margin:1.5rem auto 0;padding:.5rem 1.25rem;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text);font:inherit;cursor:pointer}
.srch-loadmore:hover{border-color:var(--srch-accent,var(--color-primary))}

/* "A bar under the header": the icon button's alternative to the overlay. The
   bar is fixed to the viewport (its top measured from the header the button
   sits in) and spans it edge to edge, so nothing can push the page sideways.
   The results list is a child of the bar rather than a full-height panel, so an
   untyped search is a search field and nothing else - no empty screen under it. */
.srch-bar-catcher{position:fixed;inset:0;z-index:118;background:transparent}
.srch-bar{position:fixed;left:0;right:0;z-index:119;box-sizing:border-box;background:var(--color-surface);border-bottom:1px solid var(--color-border);box-shadow:0 12px 32px rgba(0,0,0,.14);padding:.75rem}
.srch-bar *,.srch-bar *::before,.srch-bar *::after{box-sizing:border-box}
.srch-bar .srch-input-wrap{width:100%}
.srch-bar-results{margin-top:.5rem;overflow-y:auto;overscroll-behavior:contain}

.srch-overlay{position:fixed;inset:0;z-index:120;background:var(--color-overlay,rgba(0,0,0,.45))}
.srch-overlay-anchor{position:absolute}
.srch-overlay-anchor .srch-input-wrap{background:var(--color-surface)}
.srch-overlay-dd{margin-top:6px;background:var(--color-surface-raised,var(--color-surface));border:1px solid var(--color-border);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.14);overflow-y:auto}
.srch-overlay-panel{background:var(--color-surface);max-width:720px;margin:6vh auto 0;border-radius:12px;border:1px solid var(--color-border);box-shadow:0 24px 64px rgba(0,0,0,.25);max-height:80vh;display:flex;flex-direction:column;overflow:hidden}
.srch-overlay-head{padding:.75rem .75rem 0}
.srch-overlay-results{overflow-y:auto;padding:.375rem}

@media (max-width:640px){
.srch-overlay-panel{margin:0;max-width:none;height:100%;max-height:none;border-radius:0}
.srch-cardgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
.srch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.srch-dd{max-height:60vh}
}
`
}
