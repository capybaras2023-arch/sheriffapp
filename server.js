const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const app = express();

// ===== КОНФИГУРАЦИЯ =====
const DISCORD_CONFIG = {
    clientId: '1478771411509055539',
    clientSecret: 'DoZW9GzmS-j4rl20nZpQbxGCJ6OZy_1-', // ⚠️ ВСТАВЬТЕ СЮДА!
    redirectUri: 'http://localhost:3000/callback',
    guildId: '1471563163387297826',
    moderatorRoleId: '1478772313326358619'
};

// ===== MIDDLEWARE =====
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true для HTTPS
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
    }
}));
app.use(express.static(path.join(__dirname)));

// ===== ХРАНИЛИЩЕ ДАННЫХ =====
let tickets = [];
let users = new Map(); // Кэш пользователей

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Получение токена по коду
async function getDiscordToken(code) {
    const response = await fetch(DISCORD_CONFIG.redirectUri ? 'https://discord.com/api/oauth2/token' : DISCORD_CONFIG.redirectUri, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: DISCORD_CONFIG.clientId,
            client_secret: DISCORD_CONFIG.clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: DISCORD_CONFIG.redirectUri,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to get token');
    }

    return await response.json();
}

// Получение информации о пользователе
async function getDiscordUser(accessToken) {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to get user');
    }

    return await response.json();
}

// Получение информации о пользователе на сервере
async function getGuildMember(accessToken, userId) {
    try {
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${DISCORD_CONFIG.guildId}/members/${userId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Error fetching guild member:', error);
        return null;
    }
}

// Обновление или обмен токена
async function refreshToken(refreshToken) {
    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: DISCORD_CONFIG.clientId,
            client_secret: DISCORD_CONFIG.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh token');
    }

    return await response.json();
}

// ===== МАРШРУТЫ =====

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработка callback от Discord
app.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.redirect('/?error=no_code');
    }

    try {
        // Получаем токен
        const tokenData = await getDiscordToken(code);
        
        // Получаем информацию о пользователе
        const userData = await getDiscordUser(tokenData.access_token);
        
        // Получаем информацию о пользователе на сервере
        const guildMember = await getGuildMember(tokenData.access_token, userData.id);
        
        // Сохраняем в сессию
        req.session.user = {
            ...userData,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            guildMember: guildMember,
            expiresIn: Date.now() + (tokenData.expires_in * 1000)
        };
        
        // Сохраняем в кэш
        users.set(userData.id, req.session.user);
        
        // Перенаправляем на главную
        res.redirect('/');
        
    } catch (error) {
        console.error('Auth error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// Получение информации о текущем пользователе
app.get('/api/user/me', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Проверяем, не истек ли токен
        if (req.session.user.expiresIn < Date.now()) {
            // Обновляем токен
            const newTokenData = await refreshToken(req.session.user.refreshToken);
            
            // Получаем свежие данные
            const userData = await getDiscordUser(newTokenData.access_token);
            const guildMember = await getGuildMember(newTokenData.access_token, userData.id);
            
            // Обновляем сессию
            req.session.user = {
                ...userData,
                accessToken: newTokenData.access_token,
                refreshToken: newTokenData.refresh_token,
                guildMember: guildMember,
                expiresIn: Date.now() + (newTokenData.expires_in * 1000)
            };
        }
        
        // Отправляем данные пользователя
        res.json({
            id: req.session.user.id,
            username: req.session.user.username,
            discriminator: req.session.user.discriminator,
            avatar: req.session.user.avatar,
            email: req.session.user.email,
            guildMember: req.session.user.guildMember,
            isModerator: req.session.user.guildMember?.roles?.includes(DISCORD_CONFIG.moderatorRoleId) || false
        });
        
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Выход из системы
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.clearCookie('connect.sid');
    res.json({ success: true });
});

// Создание заявки
app.post('/api/tickets', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const ticket = {
        id: Date.now().toString(),
        ...req.body,
        author: {
            id: req.session.user.id,
            username: req.session.user.username,
            avatar: req.session.user.avatar,
            nickname: req.session.user.guildMember?.nick || req.session.user.username
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    tickets.push(ticket);
    res.status(201).json(ticket);
});

// Получение всех заявок
app.get('/api/tickets', (req, res) => {
    res.json(tickets);
});

// Обновление заявки
app.patch('/api/tickets/:id', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    const index = tickets.findIndex(t => t.id === id);
    if (index !== -1) {
        tickets[index] = { 
            ...tickets[index], 
            ...updates,
            updatedAt: new Date().toISOString()
        };
        res.json(tickets[index]);
    } else {
        res.status(404).json({ error: 'Ticket not found' });
    }
});

// ===== ЗАПУСК СЕРВЕРА =====
const PORT = 3000;
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 СЕРВЕР ЗАПУЩЕН!');
    console.log('='.repeat(50));
    console.log(`📍 Локальный адрес: http://localhost:${PORT}`);
    console.log(`🔑 Client ID: ${DISCORD_CONFIG.clientId}`);
    console.log(`🖥️  Guild ID: ${DISCORD_CONFIG.guildId}`);
    console.log(`👮 Модератор роль: ${DISCORD_CONFIG.moderatorRoleId}`);
    console.log('='.repeat(50) + '\n');
});