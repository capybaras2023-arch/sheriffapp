// ===== ВАШИ ДАННЫЕ С DISCORD =====
const DISCORD_CONFIG = {
    // Client ID вашего приложения
    CLIENT_ID: '1478771411509055539',
    
    // Client Secret (скопируйте из Discord Developer Portal)
    CLIENT_SECRET: 'DoZW9GzmS-j4rl20nZpQbxGCJ6OZy_1-', // ⚠️ ВАЖНО: вставьте сюда ваш секрет!
    
    // Redirect URI (должен совпадать с Discord Developer Portal)
    REDIRECT_URI: 'http://localhost:3000/callback',
    
    // URL вашего API
    API_ENDPOINT: 'http://localhost:3000/api',
    
    // ID вашего Discord сервера
    GUILD_ID: '1471563163387297826',
    
    // ID роли модераторов
    MODERATOR_ROLE_ID: '1478772313326358619'
};

// Discord API URLs (не изменять)
const DISCORD_API = {
    OAUTH_URL: 'https://discord.com/api/oauth2/authorize',
    TOKEN_URL: 'https://discord.com/api/oauth2/token',
    API_URL: 'https://discord.com/api/v10',
    CDN_URL: 'https://cdn.discordapp.com'
};

// Права доступа (scopes)
const SCOPES = [
    'identify',           // Основная информация
    'email',              // Email
    'guilds',             // Сервера пользователя
    'guilds.members.read' // Информация о участниках сервера
];

// Собираем URL для авторизации
const AUTH_URL = `${DISCORD_API.OAUTH_URL}?` +
    `client_id=${DISCORD_CONFIG.CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(DISCORD_CONFIG.REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}`;

// Не изменять - экспорт для браузера
if (typeof window !== 'undefined') {
    window.DISCORD_CONFIG = DISCORD_CONFIG;
    window.DISCORD_API = DISCORD_API;
    window.AUTH_URL = AUTH_URL;
}