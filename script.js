// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let tickets = [];
let currentFilter = 'all';

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Страница загружена');
    checkAuth();
    setupEventListeners();
    loadTickets();
});

// ===== НАСТРОЙКА ОБРАБОТЧИКОВ =====
function setupEventListeners() {
    // Кнопки входа
    document.getElementById('loginBtn')?.addEventListener('click', loginWithDiscord);
    document.getElementById('heroLoginBtn')?.addEventListener('click', loginWithDiscord);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    // Форма создания заявки
    document.getElementById('ticketForm')?.addEventListener('submit', createTicket);
    
    // Фильтры
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            displayTickets();
        });
    });
    
    // Модальное окно
    document.querySelector('.modal-close')?.addEventListener('click', closeModal);
    document.querySelector('.modal-overlay')?.addEventListener('click', closeModal);
}

// ===== АВТОРИЗАЦИЯ =====
function loginWithDiscord() {
    window.location.href = AUTH_URL;
}

// Проверка авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/user/me', {
            credentials: 'include'
        });
        
        if (response.ok) {
            currentUser = await response.json();
            console.log('👤 Пользователь:', currentUser);
            updateUIForAuth();
        } else {
            showHero();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showHero();
    }
}

// Выход
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        currentUser = null;
        document.getElementById('loginBtn')?.classList.remove('hidden');
        document.getElementById('heroSection')?.classList.remove('hidden');
        document.getElementById('dashboard')?.classList.add('hidden');
        document.getElementById('userInfo')?.classList.add('hidden');
        
        showNotification('Вы вышли из системы', 'info');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Обновление UI после авторизации
function updateUIForAuth() {
    // Скрываем hero, показываем дашборд
    document.getElementById('heroSection')?.classList.add('hidden');
    document.getElementById('dashboard')?.classList.remove('hidden');
    
    // Показываем информацию о пользователе
    const userInfo = document.getElementById('userInfo');
    userInfo.classList.remove('hidden');
    document.getElementById('loginBtn')?.classList.add('hidden');
    
    // Обновляем аватар и имя
    const avatarUrl = currentUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=128`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
    
    document.getElementById('userAvatar').src = avatarUrl;
    
    // Показываем никнейм (серверный если есть)
    const displayName = currentUser.guildMember?.nick || currentUser.username;
    document.getElementById('userName').textContent = displayName;
    
    // Проверяем, модератор ли пользователь
    if (currentUser.isModerator) {
        document.getElementById('moderatorPanel')?.classList.remove('hidden');
    }
    
    showNotification(`Добро пожаловать, ${displayName}!`, 'success');
}

// Показать hero секцию
function showHero() {
    document.getElementById('heroSection')?.classList.remove('hidden');
    document.getElementById('dashboard')?.classList.add('hidden');
    document.getElementById('userInfo')?.classList.add('hidden');
    document.getElementById('loginBtn')?.classList.remove('hidden');
}

// ===== РАБОТА С ЗАЯВКАМИ =====
async function createTicket(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('Необходимо войти в систему', 'error');
        return;
    }
    
    const ticketData = {
        title: document.getElementById('ticketTitle').value,
        description: document.getElementById('ticketDescription').value,
        priority: document.getElementById('ticketPriority').value
    };
    
    try {
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(ticketData)
        });
        
        if (response.ok) {
            const newTicket = await response.json();
            tickets.push(newTicket);
            document.getElementById('ticketForm').reset();
            showNotification('Заявка успешно создана!', 'success');
            updateStats();
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
        showNotification('Ошибка при создании заявки', 'error');
    }
}

// Загрузка заявок
async function loadTickets() {
    try {
        const response = await fetch('/api/tickets');
        if (response.ok) {
            tickets = await response.json();
            displayTickets();
            updateStats();
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
}

// Отображение заявок
function displayTickets() {
    const ticketsList = document.getElementById('ticketsList');
    if (!ticketsList) return;
    
    const filteredTickets = filterTickets(tickets);
    
    if (filteredTickets.length === 0) {
        ticketsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ticket-alt"></i>
                <p>Нет заявок</p>
            </div>
        `;
        return;
    }
    
    ticketsList.innerHTML = filteredTickets.map(ticket => createTicketCard(ticket)).join('');
    
    // Добавляем обработчики
    document.querySelectorAll('.ticket-card').forEach(card => {
        card.addEventListener('click', () => openTicketModal(card.dataset.id));
    });
}

// Создание карточки заявки
function createTicketCard(ticket) {
    const date = new Date(ticket.createdAt).toLocaleDateString('ru-RU');
    const authorName = ticket.author?.nickname || ticket.author?.username || 'Пользователь';
    const priorityClass = `priority-${ticket.priority}`;
    
    let statusText = 'Ожидает';
    let statusClass = 'pending';
    
    if (ticket.status === 'in-progress') {
        statusText = 'В работе';
        statusClass = 'in-progress';
    } else if (ticket.status === 'completed') {
        statusText = 'Завершена';
        statusClass = 'completed';
    }
    
    return `
        <div class="ticket-card ${priorityClass}" data-id="${ticket.id}">
            <div class="ticket-header">
                <h3 class="ticket-title">${escapeHtml(ticket.title)}</h3>
                <span class="ticket-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="ticket-meta">
                <div class="ticket-meta-item">
                    <i class="fas fa-user"></i>
                    <span>${escapeHtml(authorName)}</span>
                </div>
                <div class="ticket-meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>${date}</span>
                </div>
                <div class="ticket-meta-item">
                    <i class="fas fa-flag"></i>
                    <span>Приоритет: ${getPriorityText(ticket.priority)}</span>
                </div>
            </div>
            <p class="ticket-preview">${escapeHtml(ticket.description.substring(0, 100))}...</p>
        </div>
    `;
}

// Обновление статистики
function updateStats() {
    document.getElementById('totalTickets').textContent = tickets.length;
    document.getElementById('pendingTickets').textContent = tickets.filter(t => t.status === 'pending').length;
    document.getElementById('inProgressTickets').textContent = tickets.filter(t => t.status === 'in-progress').length;
    document.getElementById('completedTickets').textContent = tickets.filter(t => t.status === 'completed').length;
    
    // Обновляем счетчики в фильтрах
    document.getElementById('allCount').textContent = tickets.length;
    document.getElementById('pendingCount').textContent = tickets.filter(t => t.status === 'pending').length;
    document.getElementById('progressCount').textContent = tickets.filter(t => t.status === 'in-progress').length;
    document.getElementById('completedCount').textContent = tickets.filter(t => t.status === 'completed').length;
}

// Открытие модального окна
function openTicketModal(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    document.getElementById('modalTicketTitle').textContent = ticket.title;
    document.getElementById('modalTicketAuthor').textContent = ticket.author?.nickname || ticket.author?.username || 'Пользователь';
    document.getElementById('modalTicketDescription').textContent = ticket.description;
    
    const date = new Date(ticket.createdAt).toLocaleString('ru-RU');
    document.getElementById('modalTicketDate').textContent = date;
    
    // Статус
    const statusSpan = document.getElementById('modalTicketStatus');
    statusSpan.textContent = getStatusText(ticket.status);
    statusSpan.className = `badge ${ticket.status}`;
    
    // Приоритет
    const prioritySpan = document.getElementById('modalTicketPriority');
    prioritySpan.textContent = getPriorityText(ticket.priority);
    prioritySpan.className = `badge ${ticket.priority}`;
    
    // Кнопки для модераторов
    const modalActions = document.getElementById('modalActions');
    if (currentUser?.isModerator && ticket.status !== 'completed') {
        modalActions.innerHTML = `
            <button class="btn btn-primary" onclick="updateTicketStatus('${ticket.id}', 'in-progress')">
                <i class="fas fa-check"></i> Принять в работу
            </button>
            <button class="btn btn-danger" onclick="updateTicketStatus('${ticket.id}', 'completed')">
                <i class="fas fa-check-circle"></i> Завершить
            </button>
            <button class="btn btn-secondary" onclick="openDM('${ticket.author.id}')">
                <i class="fas fa-envelope"></i> Написать в личку
            </button>
        `;
    } else {
        modalActions.innerHTML = '';
    }
    
    document.getElementById('ticketModal').classList.add('active');
}

// Обновление статуса заявки
async function updateTicketStatus(ticketId, status) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            const ticket = tickets.find(t => t.id === ticketId);
            ticket.status = status;
            displayTickets();
            updateStats();
            closeModal();
            showNotification(`Статус заявки изменен на ${getStatusText(status)}`, 'success');
        }
    } catch (error) {
        console.error('Error updating ticket:', error);
        showNotification('Ошибка при обновлении', 'error');
    }
}

// Открыть DM
function openDM(userId) {
    window.open(`https://discord.com/users/${userId}`, '_blank');
    showNotification('Открыт профиль пользователя в Discord', 'info');
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('ticketModal').classList.remove('active');
}

// Фильтрация заявок
function filterTickets(tickets) {
    if (currentFilter === 'all') return tickets;
    return tickets.filter(t => t.status === currentFilter);
}

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusText(status) {
    const map = {
        'pending': 'Ожидает',
        'in-progress': 'В работе',
        'completed': 'Завершена'
    };
    return map[status] || status;
}

function getPriorityText(priority) {
    const map = {
        'low': 'Низкий',
        'medium': 'Средний',
        'high': 'Высокий'
    };
    return map[priority] || priority;
}