import { useState } from 'react'
import PropertyFilters, { DEFAULT_FILTERS } from '../PropertyFilters/PropertyFilters'

const MOCK_LISTINGS = [
  { id: 1, title: '5 Marla House — Double Storey', price: 8500000, area: 5, areaUnit: 'Marla', type: 'House', subType: 'Double Storey', purpose: 'Buy', bedrooms: 3, bathrooms: 2, city: 'Karachi', location: 'Scheme 33, Sector 7', verified: true, featured: false, possession: 'Ready', furnished: 'Unfurnished', currency: 'PKR', phone: '0300-1234567', scrapedFrom: 'Real Estate Karachi Group', scrapedAt: '2026-07-18T14:30:00Z', description: 'Brand new 5 marla house in Scheme 33. Owner built. Ground + 2 floors. Near main road.' },
  { id: 2, title: '10 Marla Residential Plot', price: 12000000, area: 10, areaUnit: 'Marla', type: 'Plot', subType: 'Residential Plot', purpose: 'Buy', bedrooms: 0, bathrooms: 0, city: 'Karachi', location: 'Scheme 33, Sector 15A', verified: true, featured: true, possession: 'Ready', furnished: 'All', currency: 'PKR', phone: '0312-9876543', scrapedFrom: 'Karachi Property Dealers', scrapedAt: '2026-07-18T13:00:00Z', description: 'Corner plot 10 marla. All utilities available. Urgent sale.' },
  { id: 3, title: '3 Marla House — Single Storey', price: 5500000, area: 3, areaUnit: 'Marla', type: 'House', subType: 'Single Storey', purpose: 'Buy', bedrooms: 2, bathrooms: 1, city: 'Karachi', location: 'Scheme 33, Sector 9', verified: false, featured: false, possession: 'Ready', furnished: 'Unfurnished', currency: 'PKR', phone: '0321-5555555', scrapedFrom: 'Real Estate Karachi Group', scrapedAt: '2026-07-18T11:45:00Z', description: 'Small family house in sector 9. Good condition. Near market.' },
  { id: 4, title: '1 Kanal Farm House', price: 45000000, area: 1, areaUnit: 'Kanal', type: 'House', subType: 'Farm House', purpose: 'Buy', bedrooms: 6, bathrooms: 4, city: 'Karachi', location: 'Gadap Town', verified: true, featured: true, possession: 'Ready', furnished: 'Furnished', currency: 'PKR', phone: '0333-1111111', scrapedFrom: 'Luxury Properties PK', scrapedAt: '2026-07-18T10:20:00Z', description: 'Luxury farmhouse 1 kanal. Swimming pool, lush garden, boundary wall.' },
  { id: 5, title: '3 Bed Flat — 2nd Floor', price: 35000, area: 1400, areaUnit: 'Sq. Ft.', type: 'Flat', subType: '3 Bed', purpose: 'Rent', bedrooms: 3, bathrooms: 2, city: 'Karachi', location: 'Gulshan-e-Iqbal, Block 13D', verified: true, featured: false, possession: 'Ready', furnished: 'Semi-Furnished', currency: 'PKR', phone: '0345-9999999', scrapedFrom: 'Karachi Rentals Group', scrapedAt: '2026-07-18T09:00:00Z', description: '3 bed flat 2nd floor. CCTV, generator backup, secure building.' },
  { id: 6, title: '5 Marla House — Triple Storey', price: 9200000, area: 5, areaUnit: 'Marla', type: 'House', subType: 'Triple Storey', purpose: 'Buy', bedrooms: 4, bathrooms: 3, city: 'Lahore', location: 'DHA Phase 5', verified: true, featured: true, possession: 'Ready', furnished: 'Furnished', currency: 'PKR', phone: '0300-7777777', scrapedFrom: 'DHA Lahore Properties', scrapedAt: '2026-07-18T08:15:00Z', description: 'Triple storey 5 marla in DHA. Tiles flooring, marble kitchen. Prime location.' },
  { id: 7, title: 'Studio Apartment', price: 18000, area: 450, areaUnit: 'Sq. Ft.', type: 'Flat', subType: 'Studio', purpose: 'Rent', bedrooms: 1, bathrooms: 1, city: 'Islamabad', location: 'F-11 Markaz', verified: false, featured: false, possession: 'Ready', furnished: 'Furnished', currency: 'PKR', phone: '0311-2222222', scrapedFrom: 'Islamabad Rentals', scrapedAt: '2026-07-17T16:00:00Z', description: 'Fully furnished studio near F-11 markaz. Bills included.' },
  { id: 8, title: 'Commercial Plot — Main Road', price: 25000000, area: 500, areaUnit: 'Sq. Yd.', type: 'Plot', subType: 'Commercial Plot', purpose: 'Buy', bedrooms: 0, bathrooms: 0, city: 'Karachi', location: 'Tariq Road', verified: true, featured: true, possession: 'Ready', furnished: 'All', currency: 'PKR', phone: '0333-8888888', scrapedFrom: 'Commercial Properties KHI', scrapedAt: '2026-07-17T12:00:00Z', description: 'Prime commercial plot on Tariq Road. Heavy footfall. Ideal for retail.' },
]

const formatPrice = (price, purpose) => {
  if (purpose === 'Rent') return `PKR ${price.toLocaleString()}/mo`
  if (price >= 10000000) return `PKR ${(price / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (price >= 100000) return `PKR ${(price / 100000).toFixed(0)} Lac`
  return `PKR ${price.toLocaleString()}`
}

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const applyFilters = (listings, f) => {
  return listings.filter(p => {
    if (f.purpose !== 'All' && p.purpose !== f.purpose) return false
    if (f.city !== 'All Cities' && p.city !== f.city) return false
    if (f.location && !p.location.toLowerCase().includes(f.location.toLowerCase())) return false
    if (f.propertyType !== 'All' && p.type !== f.propertyType) return false
    if (f.propertySubType && p.subType !== f.propertySubType) return false
    if (f.bedrooms !== 'Any') {
      if (f.bedrooms === '6+' && p.bedrooms < 6) return false
      if (f.bedrooms !== '6+' && p.bedrooms !== parseInt(f.bedrooms)) return false
    }
    if (f.bathrooms !== 'Any') {
      if (f.bathrooms === '4+' && p.bathrooms < 4) return false
      if (f.bathrooms !== '4+' && p.bathrooms !== parseInt(f.bathrooms)) return false
    }
    if (f.priceMin && p.price < parseFloat(f.priceMin)) return false
    if (f.priceMax && p.price > parseFloat(f.priceMax)) return false
    if (f.areaMin && p.areaUnit === f.areaUnit && p.area < parseFloat(f.areaMin)) return false
    if (f.areaMax && p.areaUnit === f.areaUnit && p.area > parseFloat(f.areaMax)) return false
    if (f.verified && !p.verified) return false
    if (f.featured && !p.featured) return false
    if (f.possession !== 'All' && p.possession !== f.possession) return false
    if (f.furnished !== 'All' && p.furnished !== f.furnished) return false
    return true
  }).sort((a, b) => {
    if (f.sortBy === 'Price: Low → High') return a.price - b.price
    if (f.sortBy === 'Price: High → Low') return b.price - a.price
    if (f.sortBy === 'Area: Small → Large') return a.area - b.area
    if (f.sortBy === 'Area: Large → Small') return b.area - a.area
    return new Date(b.scrapedAt) - new Date(a.scrapedAt) // Newest First
  })
}

const PropertyCard = ({ p, viewMode, isAdmin }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-200 overflow-hidden group ${
    viewMode === 'list' ? 'flex items-stretch' : 'flex flex-col'
  }`}>
    {/* Purpose Bar */}
    <div className={`${viewMode === 'grid' ? 'h-1.5 w-full' : 'w-1.5 shrink-0'} ${p.purpose === 'Buy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />

    <div className={`p-4 flex flex-col flex-1 ${viewMode === 'list' ? 'sm:flex-row sm:items-center sm:gap-6' : ''}`}>
      <div className={`flex-1 ${viewMode === 'list' ? 'min-w-0' : ''}`}>
        {/* Badges */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.purpose === 'Buy' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'}`}>
            For {p.purpose}
          </span>
          {p.verified && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">✓ Verified</span>}
          {p.featured && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400">⭐ Featured</span>}
        </div>

        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug mb-0.5 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{p.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">📍 {p.location}, {p.city}</p>

        {/* Price */}
        <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mb-2">{formatPrice(p.price, p.purpose)}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">{p.type}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">{p.area} {p.areaUnit}</span>
          {p.bedrooms > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">🛏 {p.bedrooms}</span>}
          {p.bathrooms > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">🚿 {p.bathrooms}</span>}
          {p.furnished !== 'All' && <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-md">{p.furnished}</span>}
          {p.possession !== 'Ready' && <span className="text-[10px] font-semibold px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-650 dark:text-rose-400 rounded-md">{p.possession}</span>}
        </div>

        {viewMode === 'grid' && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-3">{p.description}</p>}
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-750 mt-auto ${viewMode === 'list' ? 'sm:border-t-0 sm:border-l sm:pl-6 sm:flex-col sm:items-end sm:gap-2 sm:w-48 sm:shrink-0 dark:sm:border-l-slate-700' : ''}`}>
        <div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">📱 {p.phone}</p>
          {isAdmin && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{p.scrapedFrom}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 dark:text-slate-550">{formatDate(p.scrapedAt)}</p>
          <button className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 cursor-pointer">
            Save ♡
          </button>
        </div>
      </div>
    </div>
  </div>
)

const PropertyListings = ({ isAdmin = false }) => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [committedFilters, setCommittedFilters] = useState(DEFAULT_FILTERS)
  const [viewMode, setViewMode] = useState('grid')

  const filtered = applyFilters(MOCK_LISTINGS, committedFilters)

  const handleSearch = (newFilters) => {
    setCommittedFilters(newFilters)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {isAdmin ? 'All Property Listings' : 'Search Properties'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin ? 'Scraped from WhatsApp groups · ' : 'Pakistan real estate · '}
            <span className="font-bold text-slate-700 dark:text-slate-300">{filtered.length}</span> results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg border cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-800 text-slate-450 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg border cursor-pointer transition-all ${viewMode === 'list' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-800 text-slate-450 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <PropertyFilters filters={filters} setFilters={setFilters} resultCount={filtered.length} onSearch={handleSearch} />

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 transition-colors">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <p className="font-semibold text-sm text-slate-600 dark:text-slate-350">No properties match your filters</p>
          <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">Try adjusting or clearing your filters</p>
        </div>
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
            : 'flex flex-col gap-3'
        }>
          {filtered.map(p => (
            <PropertyCard key={p.id} p={p} viewMode={viewMode} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}

export default PropertyListings
