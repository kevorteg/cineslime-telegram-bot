const axios = require('axios');
const config = require('../config');

const BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_LANG = 'es-ES'; // Spanish by default as per user request context

const tmdbClient = axios.create({
    baseURL: BASE_URL,
    params: {
        api_key: config.tmdbApiKey,
        language: DEFAULT_LANG
    }
});

/**
 * Search for movies and TV shows.
 * @param {string} query 
 * @param {number} page 
 */
async function searchMulti(query, page = 1) {
    try {
        const response = await tmdbClient.get('/search/multi', {
            params: { query, page, include_adult: false }
        });
        // Filter out people, only keep movie and tv
        return response.data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
    } catch (error) {
        console.error('TMDB Search Error:', error.message);
        return [];
    }
}

/**
 * Get details for a movie or TV show.
 * @param {number} id 
 * @param {string} type 'movie' or 'tv'
 */
async function getDetails(id, type) {
    try {
        const response = await tmdbClient.get(`/${type}/${id}`, {
            params: {
                append_to_response: 'credits,watch/providers,videos'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`TMDB Details Error (${type}/${id}):`, error.message);
        return null;
    }
}

/**
 * Helper to extract Watch Providers for a specific country (e.g., LATAM/Spain defaults could be inferred or passed)
 * For now we will look for 'FLATRATE' in local region or generic integration.
 * Let's assume user might want specific regions: defaulting to 'CO' (Colombia) or 'MX' (Mexico) or 'ES' (Spain) or just check what's available.
 * We'll return a map of providers.
 */
function formatProviders(providersObj, countryCode = 'ES') {
    if (!providersObj || !providersObj.results || !providersObj.results[countryCode]) {
        return null;
    }
    const regionData = providersObj.results[countryCode];
    return {
        link: regionData.link,
        flatrate: regionData.flatrate || [],
        buy: regionData.buy || [],
        rent: regionData.rent || []
    };
}

/**
 * Get weekly trending movies.
 */
async function getTrending() {
    try {
        const response = await tmdbClient.get('/trending/movie/week');
        return response.data.results;
    } catch (error) {
        console.error('TMDB Trending Error:', error.message);
        return [];
    }
}

module.exports = {
    searchMulti,
    getDetails,
    formatProviders,
    getTrending
};
