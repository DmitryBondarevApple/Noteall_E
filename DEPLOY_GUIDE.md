# Инструкция по деплою Voice Workspace на VPS

## 1. Подключение к серверу

```bash
ssh root@185.246.220.121
```

Вас попросят ввести пароль. После входа вы окажетесь в терминале сервера.

---

## 2. Установка MongoDB

```bash
# Импортируем GPG-ключ MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# Определяем версию Ubuntu
UBUNTU_CODENAME=$(lsb_release -cs)

# Добавляем репозиторий
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" | \
  tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Устанавливаем
apt-get update
apt-get install -y mongodb-org

# Запускаем и добавляем в автозагрузку
systemctl start mongod
systemctl enable mongod

# Проверяем статус
systemctl status mongod
```

Если видите `Active: active (running)` — всё ок.

### Проверка:
```bash
mongosh --eval "db.runCommand({ping: 1})"
```
Должно вернуть `{ ok: 1 }`.

---

## 3. Установка Docker и Docker Compose

```bash
# Удаляем старые версии (если есть)
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null

# Устанавливаем зависимости
apt-get update
apt-get install -y ca-certificates curl gnupg

# Добавляем Docker GPG-ключ
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавляем репозиторий
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Устанавливаем
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Проверяем
docker --version
docker compose version
```

---

## 4. Подготовка проекта на сервере

```bash
# Создаём директорию для приложения
mkdir -p /opt/voice-workspace
cd /opt/voice-workspace
```

Теперь нужно скопировать код на сервер. Есть 2 варианта:

### Вариант А: Через Git (рекомендуется)
Если вы сохранили проект на GitHub через кнопку "Save to GitHub":
```bash
git clone https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПО.git .
```

### Вариант Б: Через SCP (без Git)
С вашего компьютера:
```bash
scp -r /путь/к/проекту/* root@185.246.220.121:/opt/voice-workspace/
```

---

## 5. Настройка переменных окружения

### Backend (.env)
```bash
cat > /opt/voice-workspace/backend/.env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=voice_workspace
CORS_ORIGINS=*
JWT_SECRET_KEY=СГЕНЕРИРУЙТЕ_ДЛИННЫЙ_СЛУЧАЙНЫЙ_КЛЮЧ
EMERGENT_LLM_KEY=ВАШ_КЛЮЧ
DEEPGRAM_API_KEY=ВАШ_КЛЮЧ
OPENAI_API_KEY=ВАШ_КЛЮЧ
S3_ACCESS_KEY=XYLLCXQB0FKMXIPDZLK2
S3_SECRET_KEY=mZrVPFepon3p8xPUvosjAJu4NCD88VNN2sUBXpjb
S3_ENDPOINT=https://s3.twcstorage.ru
S3_BUCKET=context-chat-7
S3_REGION=ru-1
EOF
```

### Frontend (.env)
```bash
cat > /opt/voice-workspace/frontend/.env << 'EOF'
REACT_APP_BACKEND_URL=http://185.246.220.121
EOF
```

> **Примечание:** Если у вас будет домен с HTTPS, замените `http://185.246.220.121` на `https://ваш-домен.ru`

---

## 6. Создание Docker-файлов

### Dockerfile для Backend
```bash
cat > /opt/voice-workspace/backend/Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
EOF
```

### Dockerfile для Frontend
```bash
cat > /opt/voice-workspace/frontend/Dockerfile << 'EOF'
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
```

### Nginx конфиг для Frontend
```bash
cat > /opt/voice-workspace/frontend/nginx.conf << 'EOF'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # API proxy to backend
    location /api/ {
        proxy_pass http://backend:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        client_max_body_size 100M;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

### Docker Compose
```bash
cat > /opt/voice-workspace/docker-compose.yml << 'EOF'
version: '3.8'

services:
  backend:
    build: ./backend
    restart: always
    env_file: ./backend/.env
    network_mode: host
    ports:
      - "8001:8001"
    depends_on: []

  frontend:
    build: ./frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

networks:
  default:
    driver: bridge
EOF
```

> **Примечание:** Backend использует `network_mode: host` чтобы подключаться к MongoDB на localhost.

---

## 7. Запуск

```bash
cd /opt/voice-workspace

# Собираем и запускаем
docker compose up -d --build

# Проверяем статус
docker compose ps

# Смотрим логи
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 8. Проверка

Откройте в браузере:
```
http://185.246.220.121
```

Должна загрузиться страница входа Voice Workspace.

### Проверка API:
```bash
curl http://185.246.220.121/api/health
```
Должно вернуть: `{"status":"healthy","version":"2.0.0"}`

---

## 9. Обновление приложения

При обновлении кода:
```bash
cd /opt/voice-workspace

# Если через Git
git pull

# Пересобираем и перезапускаем
docker compose up -d --build
```

---

## 10. Полезные команды

```bash
# Логи бэкенда
docker compose logs -f backend

# Логи фронтенда
docker compose logs -f frontend

# Перезапуск
docker compose restart

# Остановка
docker compose down

# Статус MongoDB
systemctl status mongod

# Бэкап MongoDB
mongodump --out /opt/backups/$(date +%Y%m%d)
```

---

## Бонус: Настройка домена и HTTPS (опционально)

Если у вас есть домен:

```bash
# Устанавливаем Certbot
apt-get install -y certbot python3-certbot-nginx

# Получаем сертификат
certbot --nginx -d ваш-домен.ru

# Обновляем frontend/.env
echo "REACT_APP_BACKEND_URL=https://ваш-домен.ru" > /opt/voice-workspace/frontend/.env

# Пересобираем фронтенд
docker compose up -d --build frontend
```
