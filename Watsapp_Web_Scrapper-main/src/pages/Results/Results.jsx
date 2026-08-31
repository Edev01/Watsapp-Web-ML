import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import PropertyFilters, { DEFAULT_FILTERS } from '../../components/PropertyFilters/PropertyFilters'
import { CardSkeleton } from '../../components/Skeleton/Skeleton'
import { propertyApi } from '../../api'

// ── All mock data ─────────────────────────────────────────────────────────────
const ALL_LISTINGS = [
  { id: 1, title: '5 Marla House — Double Storey', price: 8500000, area: 5, areaUnit: 'Marla', type: 'House', subType: 'Double Storey', purpose: 'Buy', bedrooms: 3, bathrooms: 2, city: 'Karachi', location: 'Scheme 33, Sector 7', verified: true, featured: false, possession: 'Ready', furnished: 'Unfurnished', currency: 'PKR', phone: '0300-1234567', scrapedFrom: 'Real Estate Karachi', scrapedAt: '2026-07-18T14:30:00Z', description: 'Brand new 5 marla house in Scheme 33. Owner built. Ground + 2 floors. Near main road.' },
  { id: 2, title: '10 Marla Residential Plot', price: 12000000, area: 10, areaUnit: 'Marla', type: 'Plot', subType: 'Residential Plot', purpose: 'Buy', bedrooms: 0, bathrooms: 0, city: 'Karachi', location: 'Scheme 33, Sector 15A', verified: true, featured: true, possession: 'Ready', furnished: 'All', currency: 'PKR', phone: '0312-9876543', scrapedFrom: 'Karachi Property Dealers', scrapedAt: '2026-07-18T13:00:00Z', description: 'Corner plot 10 marla. All utilities available. Urgent sale.' },
  { id: 3, title: '3 Marla House — Single Storey', price: 5500000, area: 3, areaUnit: 'Marla', type: 'House', subType: 'Single Storey', purpose: 'Buy', bedrooms: 2, bathrooms: 1, city: 'Karachi', location: 'Scheme 33, Sector 9', verified: false, featured: false, possession: 'Ready', furnished: 'Unfurnished', currency: 'PKR', phone: '0321-5555555', scrapedFrom: 'Real Estate Karachi', scrapedAt: '2026-07-18T11:45:00Z', description: 'Small family house in sector 9. Good condition. Near market.' },
  { id: 4, title: '1 Kanal Farm House', price: 45000000, area: 1, areaUnit: 'Kanal', type: 'House', subType: 'Farm House', purpose: 'Buy', bedrooms: 6, bathrooms: 4, city: 'Karachi', location: 'Gadap Town', verified: true, featured: true, possession: 'Ready', furnished: 'Furnished', currency: 'PKR', phone: '0333-1111111', scrapedFrom: 'Luxury Properties PK', scrapedAt: '2026-07-18T10:20:00Z', description: 'Luxury farmhouse 1 kanal. Swimming pool, lush garden, boundary wall.' },
  { id: 5, title: '3 Bed Flat — 2nd Floor', price: 35000, area: 1400, areaUnit: 'Sq. Ft.', type: 'Flat', subType: '3 Bed', purpose: 'Rent', bedrooms: 3, bathrooms: 2, city: 'Karachi', location: 'Gulshan-e-Iqbal, Block 13D', verified: true, featured: false, possession: 'Ready', furnished: 'Semi-Furnished', currency: 'PKR', phone: '0345-9999999', scrapedFrom: 'Karachi Rentals Group', scrapedAt: '2026-07-18T09:00:00Z', description: '3 bed flat 2nd floor. CCTV, generator backup, secure building.' },
  { id: 6, title: '5 Marla House — Triple Storey', price: 9200000, area: 5, areaUnit: 'Marla', type: 'House', subType: 'Triple Storey', purpose: 'Buy', bedrooms: 4, bathrooms: 3, city: 'Lahore', location: 'DHA Phase 5', verified: true, featured: true, possession: 'Ready', furnished: 'Furnished', currency: 'PKR', phone: '0300-7777777', scrapedFrom: 'DHA Lahore Properties', scrapedAt: '2026-07-18T08:15:00Z', description: 'Triple storey 5 marla DHA. Tiles flooring, marble kitchen. Prime location.' },
  { id: 7, title: 'Studio Apartment', price: 18000, area: 450, areaUnit: 'Sq. Ft.', type: 'Flat', subType: 'Studio', purpose: 'Rent', bedrooms: 1, bathrooms: 1, city: 'Islamabad', location: 'F-11 Markaz', verified: false, featured: false, possession: 'Ready', furnished: 'Furnished', currency: 'PKR', phone: '0311-2222222', scrapedFrom: 'Islamabad Rentals', scrapedAt: '2026-07-17T16:00:00Z', description: 'Fully furnished studio near F-11 markaz. Bills included.' },
  { id: 8, title: 'Commercial Plot — Main Road', price: 25000000, area: 500, areaUnit: 'Sq. Yd.', type: 'Plot', subType: 'Commercial Plot', purpose: 'Buy', bedrooms: 0, bathrooms: 0, city: 'Karachi', location: 'Tariq Road', verified: true, featured: true, possession: 'Ready', furnished: 'All', currency: 'PKR', phone: '0333-8888888', scrapedFrom: 'Commercial Properties KHI', scrapedAt: '2026-07-17T12:00:00Z', description: 'Prime commercial plot on Tariq Road. Heavy footfall. Ideal for retail.' },
  { id: 9, title: '2 Marla Shop', price: 15000, area: 2, areaUnit: 'Marla', type: 'Commercial', subType: 'Shop', purpose: 'Rent', bedrooms: 0, bathrooms: 1, city: 'Lahore', location: 'Gulberg III', verified: true, featured: false, possession: 'Ready', furnished: 'Unfurnished', currency: 'PKR', phone: '0321-4444444', scrapedFrom: 'Lahore Commercial', scrapedAt: '2026-07-17T10:00:00Z', description: 'Ground floor shop in busy market. High visibility. Immediate possession.' },
  { id: 10, title: '8 Marla House — DHA', price: 22000000, area: 8, areaUnit: 'Marla', type: 'House', subType: 'Double Storey', purpose: 'Buy', bedrooms: 4, bathrooms: 4, city: 'Lahore', location: 'DHA Phase 6', verified: true, featured: true, possession: 'Ready', furnished: 'Semi-Furnished', currency: 'PKR', phone: '0300-6666666', scrapedFrom: 'DHA Lahore Properties', scrapedAt: '2026-07-16T14:00:00Z', description: '8 marla luxury house DHA Phase 6. Fully tiled. Separate servant quarter.' },
]

const applyFilters = (listings, f) =>
  listings.filter(p => {
    if (f.purpose && f.purpose !== 'All' && p.purpose !== f.purpose) return false
    if (f.city && f.city !== 'All Cities' && p.city !== f.city) return false
    if (f.location && !p.location.toLowerCase().includes(f.location.toLowerCase())) return false
    if (f.propertyType && f.propertyType !== 'All' && p.type !== f.propertyType) return false
    if (f.propertySubType && p.subType !== f.propertySubType) return false
    if (f.priceMin && p.price < parseFloat(f.priceMin)) return false
    if (f.priceMax && p.price > parseFloat(f.priceMax)) return false
    if (f.areaMin && p.areaUnit === f.areaUnit && p.area < parseFloat(f.areaMin)) return false
    if (f.areaMax && p.areaUnit === f.areaUnit && p.area > parseFloat(f.areaMax)) return false
    return true
  }).sort((a, b) => {
    if (f.sortBy === 'Price: Low → High') return a.price - b.price
    if (f.sortBy === 'Price: High → Low') return b.price - a.price
    if (f.sortBy === 'Area: Small → Large') return a.area - b.area
    if (f.sortBy === 'Area: Large → Small') return b.area - a.area
    return new Date(b.scrapedAt) - new Date(a.scrapedAt)
  })

const formatPrice = (price, purpose) => {
  if (purpose === 'Rent') return `PKR ${price.toLocaleString()}/mo`
  if (price >= 10000000) return `PKR ${(price / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (price >= 100000) return `PKR ${(price / 100000).toFixed(0)} Lac`
  return `PKR ${price.toLocaleString()}`
}

const formatDate = iso => new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const PropertyCard = ({ p, viewMode }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 transition-all duration-200 overflow-hidden group ${
    viewMode === 'list' ? 'flex items-stretch' : 'flex flex-col'
  }`}>
    <div className={`${viewMode === 'grid' ? 'h-1.5 w-full' : 'w-1.5 shrink-0'} ${p.purpose === 'Buy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
    <div className="p-4 flex flex-col flex-1">
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.purpose === 'Buy' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'}`}>For {p.purpose}</span>
        {p.verified && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">✓ Verified</span>}
        {p.featured && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400">⭐ Featured</span>}
      </div>
      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug mb-0.5 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{p.title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">📍 {p.location}, {p.city}</p>
      <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mb-2">{formatPrice(p.price, p.purpose)}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">{p.type}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">{p.area} {p.areaUnit}</span>
        {p.bedrooms > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">🛏 {p.bedrooms}</span>}
        {p.bathrooms > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">🚿 {p.bathrooms}</span>}
        {p.furnished !== 'All' && p.furnished !== 'Unfurnished' && <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-md">{p.furnished}</span>}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-3">{p.description}</p>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-750 mt-auto">
        <div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">📱 {p.phone}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{p.scrapedFrom}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 dark:text-slate-550">{formatDate(p.scrapedAt)}</p>
          <button className="mt-1 text-[10px] font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer">♡ Save</button>
        </div>
      </div>
    </div>
  </div>
)

// ── Results Page ──────────────────────────────────────────────────────────────
const Results = () => {
  const location = useLocation()
  const navigate = useNavigate()

  // Receive filters passed via navigation state
  const initialFilters = location.state?.filters || DEFAULT_FILTERS

  const [filters, setFilters] = useState(initialFilters)
  const [committed, setCommitted] = useState(initialFilters) // filters actually applied to results
  const [viewMode, setViewMode] = useState('grid')
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)

  // Fetch real data from API
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true)
      setError(null)
      
      try {
        console.log('🔍 Searching with filters:', committed)
        
        const response = await propertyApi.search(committed)
        
        console.log('✅ API Response:', response)
        
        if (response.error) {
          throw new Error(response.message || 'Search failed')
        }
        
        // Transform API results to match frontend format
        const properties = response.data?.properties || response.properties || []
        
        // Map backend fields to frontend format
        const transformedResults = properties.map(p => ({
          id: p.id || p.message_id || p.whatsappMessageId,
          title: p.summary || p.rawMessage?.substring(0, 60) || 'Property Listing',
          price: p.parsedPricePKR || p.price_value || 0,
          area: p.parsedAreaInTargetUnit || p.size_value || 0,
          areaUnit: p.targetAreaUnit || p.size_unit || p.areaUnit || 'Marla',
          type: p.propertyType || p.property_type || 'House',
          subType: p.propertySubType || p.property_sub_type || '',
          purpose: p.purpose === 'SALE' ? 'Buy' : (p.purpose === 'RENT' ? 'Rent' : 'Buy'),
          bedrooms: 0, // Not currently extracted
          bathrooms: 0, // Not currently extracted
          city: p.city || 'Unknown',
          location: p.location || p.vicinity || p.area || '',
          verified: false,
          featured: false,
          possession: 'Ready',
          furnished: 'Unfurnished',
          currency: 'PKR',
          phone: p.contactNumber || p.contact_number || '',
          scrapedFrom: p.chatName || p.chat_name || 'WhatsApp',
          scrapedAt: p.createdAt || p.created_at || p.message_timestamp || new Date().toISOString(),
          description: p.rawMessage || p.raw_message || p.summary || '',
          relevanceScore: p.relevanceScore || p.similarity_score || 0,
        }))
        
        setResults(transformedResults)
        
      } catch (err) {
        console.error('❌ Search error:', err)
        setError(err.message || 'Failed to fetch properties')
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [committed])

  const handleSearch = (newFilters) => {
    setCommitted(newFilters)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-750 cursor-pointer transition-colors shrink-0"
          >
            <svg className="w-5 h-5 text-slate-600 dark:text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              </svg>
            </div>
            <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">WhatsScrape</span>
          </div>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <h1 className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
            Search Results
            {committed.city !== 'All Cities' && ` · ${committed.city}`}
            {committed.location && ` · ${committed.location}`}
          </h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Active Filters Summary Bar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 shadow-sm mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-colors">
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-wide mb-1">Active Search Filters</p>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                For {committed.purpose}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600">
                📍 {committed.city}
              </span>
              {committed.location && (
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-900/50">
                  🔍 "{committed.location}"
                </span>
              )}
              {committed.propertyType !== 'All' && (
                <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-900/50">
                  🏠 {committed.propertyType} {committed.propertySubType ? `(${committed.propertySubType})` : ''}
                </span>
              )}
              {(committed.priceMin || committed.priceMax) && (
                <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-900/50">
                  💰 {committed.priceMin ? `${committed.priceMin} ${committed.currency}` : '0'} to {committed.priceMax ? `${committed.priceMax} ${committed.currency}` : 'Max'}
                </span>
              )}
              {committed.bedrooms !== 'Any' && (
                <span className="text-xs font-bold px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-lg border border-rose-100 dark:border-rose-900/50">
                  🛏 {committed.bedrooms} Beds
                </span>
              )}
              {committed.verified && (
                <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                  ✓ Verified Only
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-750 text-white rounded-xl font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-650 transition-colors cursor-pointer self-start md:self-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Modify Search
          </button>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-600 dark:text-slate-350">
            Showing <span className="font-bold text-slate-900 dark:text-slate-100">{results.length}</span> properties
            {committed.city !== 'All Cities' && <span className="text-slate-500 dark:text-slate-400"> in {committed.city}</span>}
            {committed.location && <span className="text-slate-500 dark:text-slate-400"> near "{committed.location}"</span>}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg border cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-800 text-slate-450 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg border cursor-pointer transition-all ${viewMode === 'list' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-800 text-slate-450 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-5 mb-6 flex items-center gap-3">
            <svg className="w-6 h-6 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="font-bold text-rose-700 dark:text-rose-400 text-sm">Search Error</p>
              <p className="text-xs text-rose-600 dark:text-rose-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results Grid/List / Skeleton Loading */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 transition-colors">
            <svg className="w-14 h-14 mx-auto text-slate-300 dark:text-slate-650 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="font-bold text-slate-600 dark:text-slate-350 text-base">No properties found</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Try adjusting your filters and search again</p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
              : 'flex flex-col gap-3'
          }>
            {results.map(p => (
              <PropertyCard key={p.id} p={p} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Results
