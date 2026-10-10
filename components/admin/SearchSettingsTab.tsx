'use client'

import { useEffect, useRef, useState } from 'react'
import { TabStrip } from '@/components/admin/TabStrip'
import { SettingsHeaderActions, SettingsHeaderStatus } from '@/components/admin/SettingsHeaderActions'
import { useTabParam } from '@/modules/search/lib/admin-tab-url'
import SearchDashboard from '@/modules/search/components/admin/SearchDashboard'
import { ALLOWED_LANGUAGES, type SearchSettings, type SearchSourceKey } from '@/modules/search/lib/types'
import { InfoTip } from '@/components/admin/InfoTip'

type StatusSource = { key: SearchSourceKey; label: string; available: boolean; enabled: boolean; documentCount: number }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '.375rem .5rem', border: '1px solid var(--color-border)',
  borderRadius: 6, fontSize: '.8125rem', fontFamily: 'inherit', background: 'var(--color-surface)', color: 'var(--color-text)',
}

function SettingsForm() {
  const [settings, setSettings] = useState<SearchSettings | null>(null)
  const [sources, setSources] = useState<StatusSource[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildDone, setRebuildDone] = useState<number | null>(null)
  const [rebuildProgress, setRebuildProgress] = useState(0)
  const rebuildCancelRef = useRef(false)

  // Same cursor loop as the Search dashboard: one bounded batch per request,
  // repeated until done, so any size of site rebuilds without a timeout.
  const rebuildIndex = async () => {
    setRebuilding(true)
    setRebuildDone(null)
    setRebuildProgress(0)
    rebuildCancelRef.current = false
    type RebuildCursor = { source: SearchSourceKey; offset: number } | null
    let cursor: RebuildCursor = null
    let processed = 0
    try {
      for (let guard = 0; guard < 500; guard++) {
        if (rebuildCancelRef.current) break
        const res = await fetch('/api/m/search/admin/reindex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full: true, cursor }),
        })
        if (!res.ok) {
          setError('Rebuild failed - try again.')
          break
        }
        const result = (await res.json()) as { done: boolean; cursor: RebuildCursor; processed: number }
        processed += result.processed
        setRebuildProgress(processed)
        if (result.done) {
          setRebuildDone(processed)
          break
        }
        cursor = result.cursor
      }
    } catch {
      setError('Rebuild failed - try again.')
    } finally {
      setRebuilding(false)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/m/search/admin/settings'),
      fetch('/api/m/search/admin/status'),
    ]).then(async ([settingsRes, statusRes]) => {
      if (settingsRes.status === 403 || settingsRes.status === 401) {
        setForbidden(true)
        setLoading(false)
        return
      }
      setSettings(await settingsRes.json())
      if (statusRes.ok) {
        const status = (await statusRes.json()) as { sources?: StatusSource[] }
        setSources((status.sources ?? []).filter((s) => s.available))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return null
  if (forbidden || !settings) {
    return <div className="alert alert-danger">Only administrators with the search permission can view or change search settings.</div>
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/m/search/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: settings.language,
          sources: settings.sources,
          weights: settings.weights,
          queryLogging: settings.queryLogging,
          logRetentionDays: settings.logRetentionDays,
          excerptLength: settings.excerptLength,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSettings(await res.json())
      setSaved(true)
    } catch {
      setError('Could not save settings - try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-cols">
      <SettingsHeaderActions>
        <SettingsHeaderStatus message={saved ? 'Saved' : null} error={error} />
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </SettingsHeaderActions>

      <div className="card">
        <div className="card-title">
          What can be searched, and how it ranks
          <InfoTip>
            Site-wide master switches. A block on a page can narrow these further, but never re-enable one switched off
            here. For ranking, 1 is normal: higher lifts a content type up the results, lower pushes it down.
          </InfoTip>
        </div>
        {sources.length === 0 && <span className="field-hint">Nothing on this site can be searched yet.</span>}
        {sources.map((s) => (
          <div key={s.key} className="settings-group">
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.sources[s.key] !== false}
                onChange={(e) => setSettings({ ...settings, sources: { ...settings.sources, [s.key]: e.target.checked } })}
              />
              Search {s.label.toLowerCase()}
              <span style={{ color: 'var(--color-text-muted)', fontSize: '.75rem' }}>({s.documentCount} indexed)</span>
            </label>
            <div className="field">
              <label htmlFor={`search-weight-${s.key}`}>{s.label} ranking</label>
              <input
                id={`search-weight-${s.key}`}
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                style={inputStyle}
                value={settings.weights[s.key] ?? 1}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  setSettings({ ...settings, weights: { ...settings.weights, [s.key]: Number.isFinite(value) ? value : 1 } })
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Results and the search log</div>
        <div className="field">
          <label htmlFor="search-language">
            Language
            <InfoTip>How words are stemmed for matching. Changing this needs the index rebuilding (below) before it takes effect.</InfoTip>
          </label>
          <select
            id="search-language"
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
          >
            {ALLOWED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang === 'simple' ? 'simple (no stemming)' : lang}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="search-excerpt">
            Excerpt length (characters)
            <InfoTip>How much of each result is shown under its title.</InfoTip>
          </label>
          <input
            id="search-excerpt"
            type="number"
            min={60}
            max={600}
            value={settings.excerptLength}
            onChange={(e) => setSettings({ ...settings, excerptLength: parseInt(e.target.value, 10) || 160 })}
          />
        </div>
        <label className="settings-check field--beside-input">
          <input
            type="checkbox"
            checked={settings.queryLogging}
            onChange={(e) => setSettings({ ...settings, queryLogging: e.target.checked })}
          />
          Keep a log of search terms
          <InfoTip>No visitor details, just the words and how many results they found.</InfoTip>
        </label>
        {settings.queryLogging && (
          <div className="field">
            <label htmlFor="search-log-days">Keep the log for (days)</label>
            <input
              id="search-log-days"
              type="number"
              min={1}
              max={3650}
              value={settings.logRetentionDays}
              onChange={(e) => setSettings({ ...settings, logRetentionDays: parseInt(e.target.value, 10) || 90 })}
            />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={rebuildIndex} disabled={rebuilding}>
            {rebuilding ? `Rebuilding… ${rebuildProgress} done` : 'Rebuild index now'}
          </button>
          <InfoTip>The index refreshes itself overnight. Rebuild after changing the language or the switches above, or any time results look stale.</InfoTip>
          {rebuilding && (
            <button type="button" className="btn btn-secondary" onClick={() => { rebuildCancelRef.current = true }}>Stop</button>
          )}
          {rebuildDone !== null && !rebuilding && (
            <span style={{ fontSize: '.8125rem', color: 'var(--color-success)' }}>Done - {rebuildDone} items indexed.</span>
          )}
        </div>
      </div>
    </div>
  )
}

// Search used to own a sidebar link for the index dashboard as well as this
// settings tab. Both are the same job - looking after the search index - so the
// dashboard moved in here as a sub-tab and the sidebar link went away.
export function SearchSettingsTab() {
  const [tab, setTab] = useTabParam('sub', 'settings', ['settings', 'index'] as const)

  return (
    <div>
      <TabStrip
        items={[
          { key: 'settings', label: 'Settings', active: tab === 'settings', onClick: () => setTab('settings') },
          { key: 'index', label: 'Index & searches', active: tab === 'index', onClick: () => setTab('index') },
        ]}
      />
      {tab === 'settings' ? <SettingsForm /> : <SearchDashboard />}
    </div>
  )
}
