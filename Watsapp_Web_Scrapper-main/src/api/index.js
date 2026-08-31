const BASE_URL = import.meta.env.VITE_SCRAPPER_URL;

export const API_ENDPOINTS = {
  adminSignup: `${BASE_URL}/api/auth/admin/signup`,
  login: `${BASE_URL}/api/auth/login`,
  resetPassword: `${BASE_URL}/api/auth/reset-password`,
  users: `${BASE_URL}/api/users`,
  qrLatest: `${BASE_URL}/api/qr/latest`,
  scrapedChats: `${BASE_URL}/api/scraped-chats`,
  scrapedChatStats: `${BASE_URL}/api/scraped-chats/stats`,
  scrapedChatMessages: `${BASE_URL}/api/scraped-chats/messages`,
  scrapedChatsMonitor: `${BASE_URL}/api/scraped-chats/monitor`,
  scrapedChatsMonitored: `${BASE_URL}/api/scraped-chats/monitored`,
  propertiesFilter: `${BASE_URL}/api/properties/filter`, // AI-powered property search
};

const buildHeaders = () => {
  const token = localStorage.getItem('authToken')
  const headers = {
    'Content-Type': 'application/json',
    'bypass-tunnel-reminder': 'true',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(),
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.error) {
    throw new Error(payload?.message || payload?.error || `Server error: ${response.status}`)
  }

  return payload
}

export const scrapedChatsApi = {
  getChats: ({ type, search, limit, offset, page, pageSize } = {}) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (search) params.set('search', search)
    if (page != null) params.set('page', String(page))
    if (pageSize != null) params.set('pageSize', String(pageSize))
    if (limit != null) params.set('limit', String(limit))
    if (offset != null) params.set('offset', String(offset))
    const qs = params.toString()
    return apiRequest(`${API_ENDPOINTS.scrapedChats}${qs ? `?${qs}` : ''}`)
  },
  getChatStats: () => apiRequest(API_ENDPOINTS.scrapedChatStats),
  getMessages: (chatId) => {
    const params = new URLSearchParams({ chatId })
    return apiRequest(`${API_ENDPOINTS.scrapedChatMessages}?${params.toString()}`)
  },
  monitorChats: (jids) => apiRequest(API_ENDPOINTS.scrapedChatsMonitor, {
    method: 'POST',
    body: JSON.stringify({
      jids: Array.isArray(jids) ? jids : [jids],
    }),
  }),
  getMonitoredChats: () => apiRequest(API_ENDPOINTS.scrapedChatsMonitored),
};

/**
 * Property Search API - AI-powered intelligent search
 * 
 * Supports:
 * - Free text search with spelling correction
 * - All optional filters (purpose, city, location, type, price, area, etc.)
 * - Semantic search with embeddings
 * - Hybrid scoring (vector similarity + keyword matching)
 */
export const propertyApi = {
  /**
   * Search properties with filters
   * @param {Object} filters - Search filters
   * @param {string} filters.purpose - "Buy" or "Rent" (optional)
   * @param {string} filters.city - City name (optional)
   * @param {string} filters.location - Free text search query (optional)
   * @param {string} filters.propertyType - "House", "Flat", "Plot", "Commercial" (optional)
   * @param {string} filters.propertySubType - e.g. "Double Storey", "3 Bed" (optional)
   * @param {string} filters.sortBy - Sort order (optional)
   * @param {number} filters.priceMin - Minimum price (optional)
   * @param {number} filters.priceMax - Maximum price (optional)
   * @param {string} filters.areaUnit - "Marla", "Kanal", "Sq. Ft.", "Sq. Yd." (optional)
   * @param {number} filters.areaMin - Minimum area (optional)
   * @param {number} filters.areaMax - Maximum area (optional)
   * @returns {Promise<Object>} Search results
   */
  search: (filters) => {
    // Search bar text goes ONLY as `query`.
    // Python AI parses it (spelling fix + purpose/city/area/type/size).
    // Do NOT also send it as `location` — that made SQL look for
    // area ILIKE '%House for sale in Bahria Town%' and return zero results.
    const requestBody = {
      query: filters.location || undefined,
      purpose: filters.purpose && filters.purpose !== 'All' ? filters.purpose : undefined,
      city: filters.city && filters.city !== 'All Cities' ? filters.city : undefined,
      propertyType: filters.propertyType && filters.propertyType !== 'All' ? filters.propertyType : undefined,
      propertySubType: filters.propertySubType || undefined,
      sortBy: filters.sortBy || undefined,
      priceMin: filters.priceMin ? parseFloat(filters.priceMin) : undefined,
      priceMax: filters.priceMax ? parseFloat(filters.priceMax) : undefined,
      areaUnit: filters.areaUnit || undefined,
      areaMin: filters.areaMin ? parseFloat(filters.areaMin) : undefined,
      areaMax: filters.areaMax ? parseFloat(filters.areaMax) : undefined,
    };

    // Remove undefined values
    Object.keys(requestBody).forEach(key => {
      if (requestBody[key] === undefined) {
        delete requestBody[key];
      }
    });

    return apiRequest(API_ENDPOINTS.propertiesFilter, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },
};
