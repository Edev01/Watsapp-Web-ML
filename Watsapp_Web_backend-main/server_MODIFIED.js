// This is the MODIFIED version of server.js with Python AI integration
// Replace lines 1-15 and lines 529-615 in your original server.js

// ========== TOP OF FILE - ADD AFTER LINE 12 ==========
const axios = require('axios');
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

// ========== REPLACE handlePropertyFilter FUNCTION (Lines 529-615) ==========

// 14. Property Filter Endpoint with AI Integration
const handlePropertyFilter = async (req, res) => {
  try {
    const rawFilters = req.body?.filters || req.body || {};
    const queryFilters = req.query || {};

    const filters = {
      purpose: rawFilters.purpose || queryFilters.purpose || '',
      city: rawFilters.city || queryFilters.city || '',
      location: rawFilters.location || queryFilters.location || rawFilters.vicinity || queryFilters.vicinity || rawFilters.area || queryFilters.area || '',
      propertyType: rawFilters.propertyType || queryFilters.propertyType || rawFilters.property_type || queryFilters.property_type || '',
      propertySubType: rawFilters.propertySubType || queryFilters.propertySubType || rawFilters.property_sub_type || queryFilters.property_sub_type || '',
      sortBy: rawFilters.sortBy || queryFilters.sortBy || rawFilters.sort_by || queryFilters.sort_by || 'Newest First',
      priceMin: rawFilters.priceMin ?? queryFilters.priceMin ?? '',
      priceMax: rawFilters.priceMax ?? queryFilters.priceMax ?? '',
      areaUnit: rawFilters.areaUnit || queryFilters.areaUnit || rawFilters.area_unit || queryFilters.area_unit || 'Marla',
      areaMin: rawFilters.areaMin ?? queryFilters.areaMin ?? '',
      areaMax: rawFilters.areaMax ?? queryFilters.areaMax ?? ''
    };

    const userId = req.userId || rawFilters.userId || rawFilters.user_id || queryFilters.userId || queryFilters.user_id || 1;

    // Build natural language query from filters for AI search
    const queryParts = [];
    if (filters.propertyType) queryParts.push(filters.propertyType);
    if (filters.purpose) queryParts.push(`for ${filters.purpose}`);
    if (filters.location) queryParts.push(`in ${filters.location}`);
    else if (filters.city) queryParts.push(`in ${filters.city}`);
    const naturalQuery = queryParts.join(' ') || 'properties';

    console.log('Calling Python AI backend:', PYTHON_AI_URL);
    console.log('Query:', naturalQuery);
    console.log('Filters:', filters);

    try {
      // Call Python AI Backend
      const aiResponse = await axios.post(`${PYTHON_AI_URL}/api/dashboard-search`, {
        query: naturalQuery,
        filters: filters,
        user_id: userId,
        limit: 100
      }, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (aiResponse.data && aiResponse.data.results) {
        const aiResults = aiResponse.data.results;
        
        // Transform AI results to match expected frontend format
        const properties = aiResults.map(r => ({
          id: r.id,
          whatsappMessageId: r.whatsapp_message_id || r.id,
          chatJid: r.chat_jid || '',
          chatName: r.chat_name || '',
          sender: r.sender || '',
          purpose: r.purpose || 'SALE',
          city: r.city || '',
          location: r.vicinity || r.area || r.location || r.city || '',
          area: r.area || '',
          vicinity: r.vicinity || '',
          propertyType: r.property_type || '',
          propertySubType: r.property_sub_type || null,
          size: r.size || '',
          parsedPricePKR: r.price_value || null,
          parsedAreaInTargetUnit: r.size_value || null,
          targetAreaUnit: r.size_unit || filters.areaUnit,
          price: r.price || '',
          contactNumber: r.contact_number || '',
          summary: r.summary || '',
          rawMessage: r.message || r.raw_message || '',
          fromMe: r.from_me || false,
          from_me: r.from_me || false,
          userId: r.user_id || userId,
          user_id: r.user_id || userId,
          createdAt: r.timestamp || r.created_at,
          relevanceScore: r.relevance_score || 0
        }));

        console.log(`AI Search returned ${properties.length} results`);

        return sendResponse(res, 200, false, {
          total: properties.length,
          filters: filters,
          properties: properties,
          ai_powered: true,
          query_info: aiResponse.data.query_info || {}
        }, 'Properties retrieved successfully using AI search');
      } else {
        throw new Error('Invalid response from AI backend');
      }

    } catch (aiError) {
      console.error('Python AI backend error:', aiError.message);
      console.error('Falling back to traditional database search');

      // FALLBACK: Use original database search if AI fails
      let queryText = `
        SELECT n.*, m.message as raw_message, m.timestamp as message_timestamp, m.from_me, m.user_id, c.name as chat_name
        FROM normalized_messages n
        LEFT JOIN whatsapp_messages m ON n.whatsapp_message_id = m.id
        LEFT JOIN whatsapp_chats c ON n.chat_jid = c.jid AND m.user_id = c.user_id
        WHERE m.user_id = $1 AND (n.is_property = true OR n.purpose IS NOT NULL OR n.property_type IS NOT NULL)
      `;
      const params = [userId];
      const whereClauses = [];

      if (filters.purpose && String(filters.purpose).trim() !== '') {
        const p = String(filters.purpose).trim().toLowerCase();
        params.push(`%${p}%`);
        const idx = `$${params.length}`;
        if (p === 'buy' || p === 'sale' || p === 'sell') {
          whereClauses.push(`(LOWER(n.purpose) IN ('buy', 'sale', 'sell') OR LOWER(m.message) LIKE ${idx} OR LOWER(n.summary) LIKE ${idx})`);
        } else if (p === 'rent') {
          whereClauses.push(`(LOWER(n.purpose) = 'rent' OR LOWER(m.message) LIKE ${idx} OR LOWER(n.summary) LIKE ${idx})`);
        } else {
          whereClauses.push(`(LOWER(n.purpose) LIKE ${idx} OR LOWER(m.message) LIKE ${idx} OR LOWER(n.summary) LIKE ${idx})`);
        }
      }

      if (filters.city && String(filters.city).trim() !== '') {
        params.push(`%${String(filters.city).trim().toLowerCase()}%`);
        const idx = `$${params.length}`;
        whereClauses.push(`(LOWER(n.city) LIKE ${idx} OR LOWER(n.vicinity) LIKE ${idx} OR LOWER(n.area) LIKE ${idx} OR LOWER(m.message) LIKE ${idx})`);
      }

      if (filters.location && String(filters.location).trim() !== '') {
        params.push(`%${String(filters.location).trim().toLowerCase()}%`);
        const idx = `$${params.length}`;
        whereClauses.push(`(LOWER(n.vicinity) LIKE ${idx} OR LOWER(n.area) LIKE ${idx} OR LOWER(n.summary) LIKE ${idx} OR LOWER(m.message) LIKE ${idx})`);
      }

      if (filters.propertyType && String(filters.propertyType).trim() !== '') {
        params.push(`%${String(filters.propertyType).trim().toLowerCase()}%`);
        const idx = `$${params.length}`;
        whereClauses.push(`(LOWER(n.property_type) LIKE ${idx} OR LOWER(n.summary) LIKE ${idx} OR LOWER(m.message) LIKE ${idx})`);
      }

      if (filters.propertySubType && String(filters.propertySubType).trim() !== '') {
        params.push(`%${String(filters.propertySubType).trim().toLowerCase()}%`);
        const idx = `$${params.length}`;
        whereClauses.push(`(LOWER(n.property_type) LIKE ${idx} OR LOWER(n.summary) LIKE ${idx} OR LOWER(m.message) LIKE ${idx})`);
      }

      if (whereClauses.length > 0) {
        queryText += ' AND ' + whereClauses.join(' AND ');
      }

      queryText += ' ORDER BY n.id DESC';

      const dbResult = await db.query(queryText, params);
      const properties = filterAndSortProperties(dbResult.rows, filters);

      return sendResponse(res, 200, false, {
        total: properties.length,
        filters: filters,
        properties: properties,
        ai_powered: false,
        fallback: true
      }, 'Properties retrieved successfully using fallback search');
    }

  } catch (err) {
    console.error('Property filter error:', err);
    return sendResponse(res, 500, true, null, err.message || 'Server error');
  }
};

// Keep the route definitions the same (lines 617-620 in original file)
app.post('/api/properties/filter', handlePropertyFilter);
app.get('/api/properties/filter', handlePropertyFilter);
app.post('/api/properties', handlePropertyFilter);
app.get('/api/properties', handlePropertyFilter);
