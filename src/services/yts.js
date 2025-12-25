const axios = require('axios');

const mirrors = [
    'https://yts.mx',
    'https://yts.pm',
    'https://yts.ag',
    'https://yts.am'
];

async function searchMovie(query) {
    for (const domain of mirrors) {
        try {
            // console.log(`[YTS] Trying ${domain}...`);
            const res = await axios.get(`${domain}/api/v2/list_movies.json`, {
                params: {
                    query_term: query,
                    limit: 1,
                    sort_by: 'download_count'
                },
                timeout: 3000 // Fast fail
            });

            if (res.data && res.data.data && res.data.data.movies && res.data.data.movies.length > 0) {
                return { ...res.data.data.movies[0], url: res.data.data.movies[0].url };
            }
        } catch (e) {
            // Try next mirror
            continue;
        }
    }
    return null; // All mirrors failed
}

module.exports = { searchMovie };
