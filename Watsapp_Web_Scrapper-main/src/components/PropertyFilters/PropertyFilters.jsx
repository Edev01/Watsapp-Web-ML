import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── All sub-components OUTSIDE main component (prevent remount on render) ───

const CITIES = ['All Cities', 'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Sialkot']

const PROPERTY_TYPES = {
  'All': [],
  'House': ['Single Storey', 'Double Storey', 'Triple Storey', 'Bungalow', 'Villa', 'Farm House'],
  'Flat': ['Studio', '1 Bed', '2 Bed', '3 Bed', 'Penthouse', 'Lower Portion', 'Upper Portion'],
  'Plot': ['Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land'],
  'Commercial': ['Office', 'Shop', 'Warehouse', 'Factory', 'Building'],
}

const AREA_UNITS = ['Marla', 'Kanal', 'Sq. Ft.', 'Sq. Yd.']
const CURRENCIES = ['PKR', 'USD', 'AED']
const SORT_OPTIONS = ['Newest First', 'Price: Low → High', 'Price: High → Low', 'Area: Small → Large', 'Area: Large → Small']

const formatPriceRangeLabel = (val) => {
  if (!val || val === '0' || val === 0) return '0'
  const num = Number(val)
  if (num >= 10000000) return `${(num / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`
  if (num >= 100000) return `${(num / 100000).toFixed(0)} Lac`
  return num.toLocaleString()
}

export const DEFAULT_FILTERS = {
  purpose: '', // No default - let user choose or leave empty
  city: 'All Cities',
  location: '', // Free text search input
  propertyType: 'All',
  propertySubType: '',
  priceMin: '',
  priceMax: '',
  areaMin: '',
  areaMax: '',
  areaUnit: '', // No default - let user choose or leave empty
  sortBy: '', // No default - backend will use "Newest First" if not specified
}

// Helper components defined at MODULE level — never remounted
const Chip = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${active
        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'
      }`}
  >
    {label}
  </button>
)

const Label = ({ children }) => (
  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">{children}</p>
)

const FieldInput = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
  />
)

const FieldSelect = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-slate-800 dark:text-slate-100 cursor-pointer transition-colors"
  >
    {options.map(o => (
      <option key={o} value={o} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
        {o}
      </option>
    ))}
  </select>
)

const Toggle = ({ label, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${checked
        ? 'bg-emerald-500 text-white border-emerald-500'
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500'
      }`}
  >
    <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-white border-white' : 'border-slate-300 dark:border-slate-600'}`}>
      {checked && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" />}
    </span>
    {label}
  </button>
)

// ─── Main Component ───────────────────────────────────────────────────────────

const PropertyFilters = ({ filters, setFilters, resultCount, onSearch }) => {
  const [mobileOpen, setMobileOpen] = useState(false)

  const set = (key, val) => setFilters(prev => ({ ...prev, [key]: val }))
  const reset = () => setFilters(DEFAULT_FILTERS)

  const subTypes = PROPERTY_TYPES[filters.propertyType] || []

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    return v !== DEFAULT_FILTERS[k] && v !== '' && v !== false
  }).length

  const handleSearch = () => {
    setMobileOpen(false)
    onSearch?.(filters)
  }

  const renderFilterBody = () => (
    <div className="space-y-5">
      {/* Main Search Bar Row */}
      <div className="flex gap-2 w-full">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={filters.location}
            onChange={e => set('location', e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleSearch()
              }
            }}
            placeholder="Search by Location / Area (e.g. Scheme 33, DHA Phase 6)..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition-all"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          className="px-6 sm:px-8 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 shrink-0"
        >
          <span>Find</span>
        </button>
      </div>

      {/* Row 1: Purpose + City + Sort By */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <Label>Purpose</Label>
          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 w-full transition-colors">
            {['All', 'Buy', 'Rent'].map(p => (
              <button
                type="button"
                key={p}
                onClick={() => set('purpose', p === 'All' ? '' : p)}
                className={`flex-1 py-2 text-sm font-bold transition-all cursor-pointer ${(p === 'All' ? filters.purpose === '' : filters.purpose === p)
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>City</Label>
          <FieldSelect value={filters.city} onChange={v => set('city', v)} options={CITIES} />
        </div>
        <div>
          <Label>Sort By</Label>
          <FieldSelect value={filters.sortBy} onChange={v => set('sortBy', v)} options={SORT_OPTIONS} />
        </div>
      </div>

      {/* Row 2: Price Scroller (Full Width) */}
      {(() => {
        const maxLimit = 50000000
        const currentVal = !filters.priceMax ? maxLimit : Number(filters.priceMax)
        const pct = Math.min(100, Math.max(0, (currentVal / maxLimit) * 100))

        const presets = [
          { label: 'Any Price', value: '' },
          { label: '< 50 Lac', value: 5000000 },
          { label: '< 1 Cr', value: 10000000 },
          { label: '< 2.5 Cr', value: 25000000 },
          { label: '< 5 Cr', value: 50000000 },
        ]

        return (
          <div className="w-full bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs space-y-3 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Price Range (PKR)</span>
              <span className="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs shadow-xs">
                {currentVal >= maxLimit ? 'PKR 0 — Any Price (5 Cr+)' : `PKR 0 — ${formatPriceRangeLabel(currentVal)}`}
              </span>
            </div>

            {/* Custom Track Container */}
            <div className="relative w-full py-1 flex items-center">
              {/* Track Background & Filled Gradient */}
              <div className="absolute left-0 right-0 h-2.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden pointer-events-none border border-slate-300/30 dark:border-slate-600/30">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-75"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Native Range Input */}
              <input
                type="range"
                min="0"
                max={maxLimit}
                step="500000"
                value={currentVal}
                onChange={e => {
                  const val = Number(e.target.value) >= maxLimit ? '' : e.target.value
                  set('priceMax', val)
                  set('priceMin', '')
                }}
                className="relative z-20 w-full h-5 opacity-0 cursor-pointer"
              />

              {/* Custom Thumb Knob */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-full shadow-md shadow-emerald-500/20 pointer-events-none z-10 transition-all duration-75 flex items-center justify-center ring-4 ring-emerald-500/10"
                style={{ left: `${pct}%` }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0 mr-1">Presets:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {presets.map(p => {
                  const isActive = p.value === '' 
                    ? (!filters.priceMax || filters.priceMax == maxLimit)
                    : Number(filters.priceMax) === p.value
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        set('priceMax', p.value === maxLimit || p.value === '' ? '' : String(p.value))
                        set('priceMin', '')
                      }}
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Property Type (Centered) */}
      <div className="flex flex-col items-center justify-center text-center space-y-1.5">
        <Label>Property Type</Label>
        <div className="flex flex-wrap justify-center gap-2">
          {Object.keys(PROPERTY_TYPES).map(t => (
            <Chip
              key={t}
              label={t}
              active={filters.propertyType === t}
              onClick={() => { set('propertyType', t); set('propertySubType', '') }}
            />
          ))}
        </div>
      </div>

      {/* Property Sub Type (Centered when active) */}
      {subTypes.length > 0 && (
        <div className="flex flex-col items-center justify-center text-center space-y-1.5">
          <Label>Property Sub Type</Label>
          <div className="flex flex-wrap justify-center gap-2">
            <Chip label="Any" active={!filters.propertySubType} onClick={() => set('propertySubType', '')} />
            {subTypes.map(s => (
              <Chip key={s} label={s} active={filters.propertySubType === s} onClick={() => set('propertySubType', s)} />
            ))}
          </div>
        </div>
      )}

      {/* Area */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Area Unit</Label>
          <FieldSelect value={filters.areaUnit} onChange={v => set('areaUnit', v)} options={AREA_UNITS} />
        </div>
        <div>
          <Label>Area Min ({filters.areaUnit})</Label>
          <FieldInput value={filters.areaMin} onChange={v => set('areaMin', v)} placeholder="Min area" type="number" />
        </div>
        <div>
          <Label>Area Max ({filters.areaUnit})</Label>
          <FieldInput value={filters.areaMax} onChange={v => set('areaMax', v)} placeholder="Max area" type="number" />
        </div>
      </div>

      {/* Footer: Reset + Search */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60">
        <button
          type="button"
          onClick={reset}
          className="text-xs text-rose-500 font-bold hover:text-rose-600 cursor-pointer"
        >
          ✕ Clear Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>

        <button
          type="button"
          onClick={handleSearch}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search Properties
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm mb-5 transition-colors">
        {renderFilterBody()}
      </div>

      {/* Mobile Filter Button */}
      <div className="md:hidden mb-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer transition-colors"
        >
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
            )}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{resultCount} results</span>
        </button>
      </div>

      {/* Mobile Sheet */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 w-full bg-white dark:bg-slate-800 rounded-t-2xl max-h-[92vh] overflow-y-auto p-5 shadow-xl transition-colors">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">Filter Properties</h3>
              <button type="button" onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {renderFilterBody()}
          </div>
        </div>
      )}
    </>
  )
}

export default PropertyFilters
