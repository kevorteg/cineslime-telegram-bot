const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const db = require('./database/db');
const tmdb = require('./services/tmdb');
const limiter = require('./services/limiter');
const { searchLocalContent } = require('./services/search');
const { formatMediaCaption } = require('./utils/helpers');
const yts = require('./services/yts');

// Initialize Bot
const bot = new TelegramBot(config.telegramToken, { polling: true });

// Middleware for Auth / Welcome
const checkAuth = async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'Amigo';

    // 1. Rate Limit
    if (limiter.isRateLimited(userId)) {
        return false;
    }

    user = { is_whitelisted: 1 };
} catch (e) {
    // Race condition fallback
    user = await db.get('SELECT is_whitelisted FROM users WHERE telegram_id = ?', [userId]);
}
    }

return true;
};

// --- Command Handlers ---

// /start
bot.onText(/\/start/, async (msg) => {
    if (!await checkAuth(msg)) return;

    const name = msg.from.first_name || 'cineasta';

    bot.sendMessage(
        msg.chat.id,
        `🎬 *Bienvenido a Cineslime Bot, ${name}*\n\n` +
        `Escribe el nombre de una *película* o *serie* y te mostraré:\n` +
        `• Información completa\n` +
        `• Dónde verla legalmente\n` +
        `• Disponibilidad en nuestra colección\n\n` +
        `� Usa /help para ver todos los comandos.\n\n` +
        `�👇 *Únete a nuestro canal privado aquí:*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '🎥 Entrar al canal',
                            url: 'https://t.me/+Sc3SFX_enMk5NTUx'
                        }
                    ]
                ]
            }
        }
    );
});

// /help
bot.onText(/\/help/, async (msg) => {
    if (!await checkAuth(msg)) return;
    bot.sendMessage(msg.chat.id,
        `📚 *Comandos Disponibles:*\n\n` +
        `/peli <título> - Buscar película en TMDB\n` +
        `/serie <título> - Buscar serie en TMDB\n` +
        `/ver <título> - Solicitar archivo del canal\n` +
        `/registrar (respondiendo a un archivo) - Indexar manual\n` +
        `/populares - Ver tendencias\n` +
        `/aleatorio - Recomendación sorpresa\n` +
        `/sinanuncios - 🚫 Cómo bloquear publicidad\n` +
        `\n_También puedes escribir simplemente el título para una búsqueda inteligente._`,
        { parse_mode: 'Markdown' }
    );
});

// /peli <título>
bot.onText(/\/peli (.+)/, async (msg, match) => {
    if (!await checkAuth(msg)) return;
    bot.sendChatAction(msg.chat.id, 'typing');
    const query = match[1];
    await handleSearch(msg.chat.id, query);
});

// /serie <título>
bot.onText(/\/serie (.+)/, async (msg, match) => {
    if (!await checkAuth(msg)) return;
    bot.sendChatAction(msg.chat.id, 'typing');
    const query = match[1];
    await handleSearch(msg.chat.id, query);
});

// /sinanuncios (AdBlock Tutorial)
bot.onText(/\/sinanuncios|\/adblock/, async (msg) => {
    if (!await checkAuth(msg)) return;

    const text = `🚫 *Cómo Bloquear Publicidad en Telegram/Móvil* 🚫\n\n` +
        `Como bot, no puedo "instalar" un bloqueador en tu teléfono, pero TÚ sí puedes configurarlo gratis usando *DNS Privado*. Esto eliminará los anuncios de Shein, Casinos, etc.\n\n` +
        `🤖 *ANDROID:*\n` +
        `1. Ve a *Ajustes* > *Redes / Conexiones*.\n` +
        `2. Busca *DNS Privado*.\n` +
        `3. Selecciona "Nombre de host del proveedor" y escribe:\n` +
        `\`dns.adguard.com\`\n` +
        `4. Guardar.\n\n` +
        `🍎 *iOS / IPHONE:*\n` +
        `1. Debes descargar un perfil de DNS (es fácil).\n` +
        `2. Busca en Google "AdGuard DNS Profile iOS" o instala la app de AdGuard.\n\n` +
        `✅ *Una vez hecho, los reproductores cargarán limpios.*`;

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});



// /favoritos
bot.onText(/\/favoritos/, async (msg) => {
    if (!await checkAuth(msg)) return;

    const favs = await db.all('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [msg.from.id]);

    if (!favs || favs.length === 0) {
        bot.sendMessage(msg.chat.id, '💔 No tienes favoritos aún. ¡Agrega algunos!');
        return;
    }

    let message = '❤️ *Tus Películas Favoritas:*\n\n';
    const keyboard = [];

    favs.forEach((f) => {
        message += `• ${f.title}\n`;
        keyboard.push([{ text: `🎬 Ver ${f.title}`, callback_data: `details_${f.type}_${f.tmdb_id}` }]);
    });

    bot.sendMessage(msg.chat.id, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

// /populares
bot.onText(/\/populares/, async (msg) => {
    if (!await checkAuth(msg)) return;
    bot.sendChatAction(msg.chat.id, 'typing');

    try {
        const trending = await tmdb.getTrending();

        // Show top 5
        const top5 = trending.slice(0, 5);
        let message = '🔥 *Películas en Tendencia esta Semana:*\n\n';
        const keyboard = [];

        top5.forEach((m, i) => {
            message += `${i + 1}. *${m.title}* (⭐ ${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'})\n`;
            keyboard.push([{ text: `🎬 Ver ${m.title}`, callback_data: `details_movie_${m.id}` }]);
        });

        bot.sendMessage(msg.chat.id, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });

    } catch (e) {
        console.error(e);
        bot.sendMessage(msg.chat.id, '❌ Error interno.');
    }
});

// /aleatorio
bot.onText(/\/aleatorio/, async (msg) => {
    if (!await checkAuth(msg)) return;
    bot.sendChatAction(msg.chat.id, 'typing');

    try {
        // Recommend something from LOCAL collection
        const local = await db.all('SELECT tmdb_id, type FROM media_content ORDER BY RANDOM() LIMIT 1');

        if (local.length > 0) {
            const r = local[0];
            bot.sendMessage(msg.chat.id, '🎲 *Recomendación de la Casa*\n\n¡He seleccionado algo de nuestra colección para ti!', {
                reply_markup: { inline_keyboard: [[{ text: '🎬 Ver Sorpresa', callback_data: `details_${r.type || 'movie'}_${r.tmdb_id}` }]] }
            });
        } else {
            bot.sendMessage(msg.chat.id, '🎲 La colección está vacía. Usa /populares para ver qué hay nuevo en el mundo.');
        }
    } catch (e) {
        console.error(e);
    }
});

// /info (Admin: Stalk User)
bot.onText(/\/info/, async (msg) => {
    if (msg.from.id !== config.adminUserId) return; // Silent ignore for non-admins

    let targetId;
    let targetMsg = msg.reply_to_message;

    // Option 1: Reply to a message
    if (targetMsg) {
        targetId = targetMsg.from.id;
    } else {
        // Option 2: Argument ID
        const args = msg.text.split(' ');
        if (args[1]) targetId = parseInt(args[1]);
    }

    if (!targetId) {
        bot.sendMessage(msg.chat.id, '🕵️‍♂️ *Uso:* Responde a un mensaje del usuario o escribe `/info ID`');
        return;
    }

    try {
        const userDb = await db.get('SELECT * FROM users WHERE telegram_id = ?', [targetId]);

        // Telegram Info (from message if available, else standard API call which is limited for bots about strangers, 
        // but we have some info if they started the bot)
        // Actually getChat is useful here
        const chatInfo = await bot.getChat(targetId);

        let report = `🕵️‍♂️ *Informe de Usuario*\n\n`;
        report += `🆔 *ID*: \`${targetId}\`\n`;
        report += `👤 *Nombre*: ${chatInfo.first_name} ${chatInfo.last_name || ''}\n`;
        report += `📎 *Username*: @${chatInfo.username || 'N/A'}\n`;
        report += `🌐 *Idioma*: ${targetMsg ? (targetMsg.from.language_code || 'N/A') : 'Desconocido'}\n`;
        report += `📝 *Bio*: ${chatInfo.bio || 'Sin biografía'}\n\n`;

        if (userDb) {
            report += `📂 *Base de Datos Cineslime:*\n`;
            report += `📅 *Registrado*: ${userDb.created_at}\n`;
            report += `🔑 *Rol*: ${userDb.role}\n`;
            report += `🏅 *Favoritos*: (Consultar DB)`;
        } else {
            report += `⚠️ *No registrado en el Bot*.`;
        }

        bot.sendMessage(msg.chat.id, report, { parse_mode: 'Markdown' });

    } catch (e) {
        bot.sendMessage(msg.chat.id, `❌ Error: No puedo obtener info de ese ID (${e.message})`);
    }
});

    }
});

// --- ADMIN POWER PACK ---

// /ban ID
bot.onText(/\/ban (.+)/, async (msg, match) => {
    if (msg.from.id !== config.adminUserId) return;
    const targetId = match[1].trim();
    await db.run("UPDATE users SET is_banned = 1 WHERE telegram_id = ?", [targetId]);
    bot.sendMessage(msg.chat.id, `🔨 Usuario ${targetId} ha sido BANEADO.`);
    // Try to notify user (optional, maybe cruel?)
    bot.sendMessage(targetId, '🚫 Has sido bloqueado del bot por un administrador.').catch(() => { });
});

// /unban ID
bot.onText(/\/unban (.+)/, async (msg, match) => {
    if (msg.from.id !== config.adminUserId) return;
    const targetId = match[1].trim();
    await db.run("UPDATE users SET is_banned = 0 WHERE telegram_id = ?", [targetId]);
    bot.sendMessage(msg.chat.id, `😇 Usuario ${targetId} PERDONADO.`);
    bot.sendMessage(targetId, '✅ Has sido desbloqueado. Puedes usar el bot nuevamente.').catch(() => { });
});

// /broadcast Mensaje
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (msg.from.id !== config.adminUserId) return;
    const message = match[1];

    bot.sendMessage(msg.chat.id, '📢 Iniciando transmisión global...');

    // Get all users
    const users = await db.all("SELECT telegram_id FROM users");
    let count = 0;

    for (const u of users) {
        try {
            await bot.sendMessage(u.telegram_id, `📢 *Anuncio Oficial:*\n\n${message}`, { parse_mode: 'Markdown' });
            count++;
            // Small delay to avoid hitting Telegram limits hard
            await new Promise(r => setTimeout(r, 50));
        } catch (e) {
            // User blocked bot or deleted account
            console.log(`Failed to send to ${u.telegram_id}`);
        }
    }

    bot.sendMessage(msg.chat.id, `✅ Transmisión finalizada. Enviado a ${count} usuarios.`);
});

// /mantenimiento (Toggle)
bot.onText(/\/mantenimiento/, async (msg) => {
    if (msg.from.id !== config.adminUserId) return;

    // Check current state
    const current = await db.get("SELECT value FROM settings WHERE key = 'maintenance'");
    const newState = (current && current.value === '1') ? '0' : '1';

    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance', ?)", [newState]);

    const statusText = newState === '1' ? '🔴 ACTIVADO (Nadie puede usar el bot)' : '🟢 DESACTIVADO (Bot abierto al público)';
    bot.sendMessage(msg.chat.id, `🛠️ *Modo Mantenimiento* ha sido ${statusText}`, { parse_mode: 'Markdown' });
});

// /stats
bot.onText(/\/stats/, async (msg) => {
    if (!await checkAuth(msg)) return;
    if (msg.from.id !== config.adminUserId) {
        bot.sendMessage(msg.chat.id, '⛔ Solo para administradores.');
        return;
    }

    bot.sendChatAction(msg.chat.id, 'typing');
    try {
        const count = await db.get('SELECT COUNT(*) as c FROM media_content');
        const users = await db.get('SELECT COUNT(*) as c FROM users');

        bot.sendMessage(msg.chat.id,
            `📊 *Estadísticas de Cineslime*\n\n` +
            `🎥 Películas/Series: *${count.c}*\n` +
            `👥 Usuarios: *${users.c}*`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        bot.sendMessage(msg.chat.id, '❌ Error obteniendo estadísticas.');
    }
});

// /admin
bot.onText(/\/admin/, async (msg) => {
    if (!await checkAuth(msg)) return;
    if (msg.from.id !== config.adminUserId) return;

    bot.sendMessage(msg.chat.id,
        `🔧 *Panel de Administración*\n\n` +
        `/stats - Ver estadísticas\n` +
        `/allow <user_id> - Autorizar usuario`,
        { parse_mode: 'Markdown' }
    );
});

// /allow <id>
bot.onText(/\/allow (.+)/, async (msg, match) => {
    if (msg.from.id !== config.adminUserId) return;
    const targetId = match[1];
    try {
        await db.run('UPDATE users SET is_whitelisted = 1 WHERE telegram_id = ?', [targetId]);
        // If user didn't exist, insert them
        const user = await db.get('SELECT id FROM users WHERE telegram_id = ?', [targetId]);
        if (!user) {
            await db.run('INSERT INTO users (telegram_id, is_whitelisted) VALUES (?, 1)', [targetId]);
        }
        bot.sendMessage(msg.chat.id, `✅ Usuario ${targetId} autorizado.`);
    } catch (e) {
        bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`);
    }
});

// /registrar <titulo> | <año>
bot.onText(/\/registrar (.+)/, async (msg, match) => {
    if (!await checkAuth(msg)) return;
    if (msg.from.id !== config.adminUserId) return;

    if (!msg.reply_to_message || (!msg.reply_to_message.document && !msg.reply_to_message.video)) {
        bot.sendMessage(msg.chat.id, '⚠️ Debes responder a un archivo de video o documento.');
        return;
    }

    const args = match[1].split('|');
    const title = args[0].trim();
    const year = args[1] ? parseInt(args[1].trim()) : null;

    if (!title || !year) {
        bot.sendMessage(msg.chat.id, '⚠️ Formato: /registrar Título | Año');
        return;
    }

    const file = msg.reply_to_message.video || msg.reply_to_message.document;
    const fileId = file.file_id;
    const caption = msg.reply_to_message.caption || '';

    // Search TMDB
    const searchRes = await tmdb.searchMulti(title);
    let bestMatch = searchRes.find(r =>
        (r.release_date || r.first_air_date || '').includes(year.toString())
    );

    if (!bestMatch && searchRes.length > 0) bestMatch = searchRes[0];

    const tmdbId = bestMatch ? bestMatch.id : null;
    const type = bestMatch ? bestMatch.media_type : 'movie';

    await db.run(`INSERT INTO media_content
    (tmdb_id, type, title, year, file_id, caption, quality)
    VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [tmdbId, type, title, year, fileId, caption, 'HD']
    );

    bot.sendMessage(msg.chat.id, `✅ Contenido registrado: *${title}* (${year}) [TMDB: ${tmdbId || 'No vinculado'}]`, { parse_mode: 'Markdown' });
});

// Helper: Handle File Indexing (Auto or Forwarded)
async function handleFileIndexing(msg) {
    if (!msg.video && !msg.document) return;

    const file = msg.video || msg.document;
    const fileId = file.file_id;
    const caption = msg.caption || '';

    console.log(`[DEBUG] Procesando archivo. Caption raw: "${caption}"`);

    let title, year;

    // Regex 1: "Title (Year)"
    let match = caption.match(/(.+?)\((\d{4})\)/);
    if (match) {
        title = match[1].trim();
        year = parseInt(match[2]);
        console.log(`[DEBUG] Regex 1 match: ${title} - ${year}`);
    } else {
        // Regex 2: "Pelicula: Title ... Año: Year"
        console.log('[DEBUG] Trying Regex 2...');
        const titleMatch = caption.match(/Pelicula:\s*(.*?)(?:\n|A[nñ]o:|$)/i);
        const yearMatch = caption.match(/A[nñ]o:\s*(\d{4})/i);

        if (titleMatch && yearMatch) {
            title = titleMatch[1].trim();
            year = parseInt(yearMatch[1]);
        }
    }

    if (title && year) {
        console.log(`[DEBUG] Searching TMDB for: ${title}`);
        const searchRes = await tmdb.searchMulti(title);
        let tmdbId = null;
        let type = 'movie';

        if (searchRes.length > 0) {
            const exactMatch = searchRes.find(r => (r.release_date || r.first_air_date || '').includes(year.toString()));
            const match = exactMatch || searchRes[0];
            tmdbId = match.id;
            type = match.media_type;
            console.log(`[DEBUG] TMDB Found: ${tmdbId}`);
        } else {
            console.log('[DEBUG] TMDB returned 0 results');
        }

        const exist = await db.get('SELECT id FROM media_content WHERE file_id = ?', [fileId]);
        if (!exist) {
            await db.run(`INSERT INTO media_content
                (tmdb_id, type, title, year, file_id, caption, quality)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [tmdbId, type, title, year, fileId, caption, 'HD']
            );
            console.log(`✅ SAVED TO DB: ${title}`);
            try {
                bot.sendMessage(msg.chat.id, `✅ Guardado en Base de Datos:\n${title} (${year})`);
            } catch (e) { console.log('Error sending confirmation:', e.message); }
        } else {
            console.log('[DEBUG] File already exists in DB');
            bot.sendMessage(msg.chat.id, `⚠️ Ya existe en la base de datos: ${title}`);
        }
    } else {
        console.log(`[DEBUG] Failed to parse title/year for: ${caption}`);
        // Consider silencing "failed to parse" for channels to avoid noise, 
        // but user wanted feedback. Let's send only if it looks like a movie post attempt.
    }
}

// Channel Post Listener
bot.on('channel_post', async (msg) => {
    handleFileIndexing(msg);
});

// Polling Error
bot.on('polling_error', (error) => {
    console.log('Polling Error:', error.message);
});

// Core Search Logic
async function handleSearch(chatId, query) {
    // 1. Search Local
    const localMatches = await searchLocalContent(query);

    if (localMatches.length > 0) {
        const match = localMatches[0];
        if (match.tmdb_id) {
            try {
                const details = await tmdb.getDetails(match.tmdb_id, match.type || 'movie');
                const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
                const caption = `✅ *DISPONIBLE EN EL CANAL*\n\n` +
                    `🎬 *${match.title}* (${match.year})\n` +
                    `💾 *Calidad*: ${match.quality || 'HD'}\n` +
                    `🗣 *Idioma*: ${match.language || 'Español'}\n\n` +
                    `¿Deseas recibir el archivo ahora?`;

                const opts = {
                    caption: caption,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '▶️ Enviar Película al Chat', callback_data: `send_${match.id}` }
                        ]]
                    }
                };

                if (posterUrl) {
                    bot.sendPhoto(chatId, posterUrl, opts);
                } else {
                    bot.sendMessage(chatId, caption, opts);
                }
            } catch (e) {
                bot.sendMessage(chatId, `✅ *Encontrado*: ${match.title}\n\nEnvía /ver para descargar.`);
            }
        } else {
            bot.sendMessage(chatId, `📂 *Encontrado:* ${match.title}\n Usa el botón para ver.`, {
                reply_markup: { inline_keyboard: [[{ text: '⬇️ Obtener', callback_data: `send_${match.id}` }]] }
            });
        }
        return;
    }

    // 2. Search Universal (TMDB + YTS + Online)
    bot.sendMessage(chatId, `🔎 Buscando "${query}" en TMDB y Redes...`);

    try {
        const results = await tmdb.searchMulti(query);

        if (results.length === 0) {
            bot.sendMessage(chatId, '❌ No se encontraron resultados. Intenta ser más específico.');
            return;
        }

        const bestMatch = results[0];

        // Detailed Info
        const details = await tmdb.getDetails(bestMatch.id, bestMatch.media_type);
        const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
        const title = details.title || details.name;
        const year = (details.release_date || details.first_air_date || '????').split('-')[0];
        const overview = details.overview ? details.overview.substring(0, 300) + '...' : 'Sin sinopsis.';

        let caption = `🎬 *${title}* (${year})\n` +
            `⭐ *${details.vote_average.toFixed(1)}/10*\n\n` +
            `📝 ${overview}\n\n` +
            `⚠️ *No disponible en el canal privado.*`;

        const keyboard = [];

        // 3. Check YTS (Movies only)
        if (bestMatch.media_type === 'movie') {
            const ytsMovie = await yts.searchMovie(title);
            if (ytsMovie) {
                caption += `\n\n🏴‍☠️ *Disponible en YTS (Torrent)*:\nCalidad: ${ytsMovie.torrents.map(t => t.quality).join(', ')}`;
                keyboard.push([{ text: '🧲 Ver Torrent (YTS)', url: ytsMovie.url }]);
            }
        }

        // 4. Watch Online (Multiple Servers)
        const type = bestMatch.media_type;
        const tmdbId = bestMatch.id;

        // Add Warning about Ads
        caption += `\n\n⚠️ *Nota Importante*: Los reproductores online son externos y contienen PUBLICIDAD. \n🛡️ *Se recomienda usar un bloqueador de anuncios (AdBlock) o navegador Brave.*`;
        caption += `\n🔊 *Audio*: Multi-lenguaje (Busca el icono de engranaje/bandera en el player).`;

        const server1 = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
        const server2 = `https://vidsrc.to/embed/${type}/${tmdbId}`;

        keyboard.push([
            { text: '🎬 Ver en Cine (WebApp)', web_app: { url: server1 } },
            { text: '🌐 Ver en Navegador', url: server2 }
        ]);

        // Add "Pedir al Admin" and "Favoritos" button
        keyboard.push([
            { text: '🔔 Solicitar', callback_data: `request_${bestMatch.id}` },
            { text: '❤️ Favoritos', callback_data: `add_fav_${bestMatch.id}` }
        ]);

        if (posterUrl) {
            bot.sendPhoto(chatId, posterUrl, { caption, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
        } else {
            bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
        }

    } catch (error) {
        console.error('Error Search:', error);
        bot.sendMessage(chatId, '❌ Error buscando en internet.');
    }
}

// Global Message Listener (Smart Search)
bot.on('message', async (msg) => {
    // 0. Indexing check for admin
    if ((msg.video || msg.document)) {
        if (await checkAuth(msg) && msg.from.id === config.adminUserId) {
            await handleFileIndexing(msg);
            return;
        }
    }

    if (msg.text && msg.text.startsWith('/')) return;
    if (!msg.text) return;

    if (!await checkAuth(msg)) return;

    // Only search automatically in private chats
    if (msg.chat.type === 'private') {
        bot.sendChatAction(msg.chat.id, 'typing');
        const query = msg.text;
        await handleSearch(msg.chat.id, query);
    }
});

// Callback Query Handler
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('details_')) {
        const parts = data.split('_');
        const type = parts[1];
        const id = parts[2];

        try {
            const details = await tmdb.getDetails(id, type);
            if (!details) {
                bot.sendMessage(chatId, '❌ Error al obtener detalles.');
                return;
            }

            const caption = formatMediaCaption(details, type);
            const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;

            // Check local DB
            const localFile = await db.get('SELECT id FROM media_content WHERE tmdb_id = ?', [id]);
            const keyboard = [];

            if (localFile) {
                keyboard.push([{ text: '✅ DISPONIBLE - ENVIAR AHORA', callback_data: `send_${localFile.id}` }]);
            } else {
                // Add online search options if not found locally
                const title = details.title || details.name;
                const year = (details.release_date || details.first_air_date || '????').split('-')[0];

                // YTS
                if (type === 'movie') {
                    const ytsMovie = await yts.searchMovie(title);
                    if (ytsMovie) keyboard.push([{ text: '🧲 YTS Torrent', url: ytsMovie.url }]);
                }
                // WARNING & INFO
                const warning = `\n\n⚠️ *Usa AdBlock para evitar publicidad.*\n🔊 El audio suele ser seleccionable en el reproductor.`;

                // Direct Embed Links
                const server1 = `https://vidsrc.xyz/embed/${type}/${id}`;
                const server2 = `https://vidsrc.to/embed/${type}/${id}`;

                keyboard.push([
                    { text: '🎬 Ver en Cine (WebApp)', web_app: { url: server1 } },
                    { text: '🌐 Ver en Navegador', url: server2 }
                ]);

                keyboard.push([{ text: '🔔 Solicitar', callback_data: `request_${id}` }]);

                // Tweaking the send options slightly to append warning if poster is present
                caption += warning;
            };

            const opts = {
                caption: caption,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            };

            if (posterUrl) {
                await bot.sendPhoto(chatId, posterUrl, opts);
            } else {
                await bot.sendMessage(chatId, caption, opts);
            }

        } catch (e) {
            console.error(e);
            bot.sendMessage(chatId, '❌ Error interno.');
        }
    }

    // Send File
    if (data.startsWith('send_')) {
        const fileDbId = data.split('_')[1];
        const fileRecord = await db.get('SELECT file_id, caption FROM media_content WHERE id = ?', [fileDbId]);

        if (fileRecord) {
            bot.sendDocument(chatId, fileRecord.file_id, { caption: fileRecord.caption });
        } else {
            bot.sendMessage(chatId, '❌ Error enviando archivo.');
        }
    }

    // Request Handler (User clicks button)
    if (data.startsWith('request_')) {
        const tmdbId = data.split('_')[1];
        const bestMatch = await tmdb.getDetails(tmdbId, 'movie'); // Assume movie or generic catch
        const title = bestMatch ? (bestMatch.title || bestMatch.name) : 'ID ' + tmdbId;

        const userId = query.from.id;

        // Check if already requested
        const existing = await db.get("SELECT id FROM requests WHERE user_id = ? AND tmdb_id = ? AND status = 'pending'", [userId, tmdbId]);

        if (existing) {
            bot.answerCallbackQuery(query.id, { text: '⚠️ Ya has solicitado esto. Paciencia.' });
        } else {
            await db.run("INSERT INTO requests (user_id, tmdb_id, title) VALUES (?, ?, ?)", [userId, tmdbId, title]);
            bot.sendMessage(chatId, '✅ Solicitud registrada. Te avisaremos cuando la subamos.');

            // Notify Admin
            bot.sendMessage(config.adminUserId, `🔔 *Nueva Petición*\nUsuario: ${query.from.first_name}\nPelicula: ${title}`, { parse_mode: 'Markdown' });
        }
    }

    // Admin Request Management
    // req_ok_ID
    if (data.startsWith('req_ok_')) {
        const reqId = data.split('_')[2];
        const req = await db.get("SELECT * FROM requests WHERE id = ?", [reqId]);

        if (req) {
            await db.run("UPDATE requests SET status = 'completed' WHERE id = ?", [reqId]);
            bot.deleteMessage(chatId, query.message.message_id);
            bot.sendMessage(chatId, `✅ Solicitud #${reqId} marcada como completada.`);

            // Notify User
            if (req.user_id) {
                bot.sendMessage(req.user_id, `🥳 *¡Buenas noticias!*\n\nLa película que pediste (*${req.title}*) ya ha sido subida al bot.\n\nUsa /peli ${req.title} para verla.`, { parse_mode: 'Markdown' });
            }
        }
    }



    // Add to Favorites
    if (data.startsWith('add_fav_')) {
        const tmdbId = data.split('_')[2];
        const type = 'movie'; // Defaulting to movie for simplicity in button callback, ideally pass type too

        // We often need title to maximize UX, but fetching it again is costly? 
        // Let's rely on user context or fetch simple details.
        try {
            // Check if exists
            const exists = await db.get('SELECT id FROM favorites WHERE user_id = ? AND tmdb_id = ?', [query.from.id, tmdbId]);
            if (exists) {
                bot.answerCallbackQuery(query.id, { text: '⚠️ Ya está en favoritos' });
            } else {
                const details = await tmdb.getDetails(tmdbId, type);
                const title = details ? (details.title || details.name) : 'Desconocido';

                await db.run('INSERT INTO favorites (user_id, tmdb_id, type, title) VALUES (?, ?, ?, ?)',
                    [query.from.id, tmdbId, type, title]);
                bot.answerCallbackQuery(query.id, { text: '❤️ Añadido a Favoritos' });
            }
        } catch (e) { console.error(e); }
    }
});

console.log('🤖 Cineslime Bot running...');
module.exports = bot;
