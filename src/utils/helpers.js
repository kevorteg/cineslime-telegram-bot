/**
 * Formats a movie/show overview for the Telegram message.
 * @param {object} details - TMDB details object
 * @param {string} type - 'movie' or 'tv'
 */
function formatMediaCaption(details, type) {
    const title = type === 'movie' ? details.title : details.name;
    const year = (type === 'movie' ? details.release_date : details.first_air_date)?.split('-')[0] || 'N/A';
    const originalTitle = type === 'movie' ? details.original_title : details.original_name;
    const genres = details.genres.map(g => g.name).join(', ');
    const rating = details.vote_average ? `⭐ ${details.vote_average.toFixed(1)}/10` : 'N/A';
    const runtime = type === 'movie'
        ? `${details.runtime} min`
        : `${details.number_of_seasons} Temporadas`;

    let cast = '';
    if (details.credits && details.credits.cast) {
        cast = details.credits.cast.slice(0, 5).map(c => c.name).join(', ');
    }

    const director = type === 'movie' && details.credits && details.credits.crew
        ? details.credits.crew.find(c => c.job === 'Director')?.name
        : (details.created_by || []).map(c => c.name).join(', ');

    return `🎬 *${title}* (${year})\n` +
        `📝 *Original*: ${originalTitle}\n` +
        `⭐ *Rating*: ${rating}\n` +
        `🎭 *Género*: ${genres}\n` +
        `⏱ *Duración*: ${runtime}\n` +
        `🎥 *Dirección/Creador*: ${director || 'N/A'}\n` +
        `👥 *Reparto*: ${cast}\n\n` +
        `📖 *Sinopsis*:\n${details.overview ? details.overview.slice(0, 500) + (details.overview.length > 500 ? '...' : '') : 'Sin sinopsis disponible.'}`;
}

module.exports = {
    formatMediaCaption
};
