# 🚀 Inicio Rápido - Despliegue en 15 minutos

Sigue estos pasos en orden para tener tu aplicación en producción.

---

## ⏱️ Tiempo estimado: 15 minutos

---

## 📋 Paso 1: Preparación (2 min)

### ✅ Asegúrate de tener:
- [ ] Código actualizado en Git
- [ ] Cuenta en [Render.com](https://render.com)
- [ ] Cuenta en [Netlify.com](https://netlify.com)
- [ ] Connection String de Neon (PostgreSQL)
- [ ] Credenciales de Cloudinary

---

## 🔧 Paso 2: Desplegar Backend en Render (5 min)

### 1. Ir a Render
👉 https://dashboard.render.com/

### 2. Crear nuevo servicio
- Click **"New +"** → **"Web Service"**
- Conecta tu repositorio GitHub
- Selecciona tu repo: `proyecto_netland`

### 3. Configurar servicio
```
Name:               netland-backend
Region:             Oregon (US West)
Branch:             main
Root Directory:     backend
Runtime:            Python 3
Build Command:      pip install -r requirements.txt
Start Command:      uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 4. Agregar Variables de Entorno
Click en **"Advanced"** → **"Add Environment Variable"**

**Copia y pega estas (reemplaza con tus valores):**

```env
DATABASE_URL
postgresql://usuario:password@host.neon.tech/netland?sslmode=require

SECRET_KEY
TuClaveSecretaSuperSeguraMinimo32Caracteres

CLOUDINARY_CLOUD_NAME
tu_cloud_name

CLOUDINARY_API_KEY
tu_api_key

CLOUDINARY_API_SECRET
tu_api_secret

FRONTEND_URL
https://netland.netlify.app

CORS_ORIGINS
https://netland.netlify.app,http://localhost:5173
```

### 5. Deploy
- Click **"Create Web Service"**
- Espera 3-5 minutos
- ✅ Copia la URL: `https://web-netland.onrender.com`

### 6. Ejecutar migraciones
Una vez desplegado:
- Click en **"Shell"** (menú lateral)
- Ejecuta:
```bash
alembic upgrade head
python -m app.seed
```

---

## 🌐 Paso 3: Desplegar Frontend en Netlify (5 min)

### Opción A: Desde Git (Recomendada)

#### 1. Ir a Netlify
👉 https://app.netlify.com/

#### 2. Importar proyecto
- Click **"Add new site"** → **"Import an existing project"**
- Conecta GitHub
- Selecciona tu repo: `proyecto_netland`

#### 3. Configurar build
```
Base directory:     frontend
Build command:      npm run build
Publish directory:  frontend/dist
```

#### 4. Agregar Variables de Entorno
Click en **"Show advanced"** → **"New variable"**

```env
VITE_API_URL
https://web-netland.onrender.com/api

VITE_WHATSAPP_NUMBER
51985928062
```

#### 5. Deploy
- Click **"Deploy site"**
- Espera 2-3 minutos
- ✅ Copia la URL: `https://tu-nombre.netlify.app`

### Opción B: Deploy Manual (Más rápido)

```bash
# En tu computadora
cd frontend
npm run build

# Instalar CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
# Publish directory: dist
```

---

## 🔄 Paso 4: Conectar Todo (3 min)

### 1. Actualizar CORS en Render
- Ve a Render Dashboard
- Tu servicio → **"Environment"**
- Edita estas variables con la URL real de Netlify:

```env
FRONTEND_URL=https://tu-nombre-real.netlify.app
CORS_ORIGINS=https://tu-nombre-real.netlify.app,http://localhost:5173
```

- Guarda (se redesplegará automáticamente)

### 2. Verificar
Abre tu sitio de Netlify y prueba:
- [ ] La página carga correctamente
- [ ] Los proyectos se muestran
- [ ] Login de admin funciona
- [ ] Puedes subir imágenes

---

## ✅ ¡Listo!

### 🎉 Tu aplicación está en vivo:

**Sitio Público:**
```
https://tu-nombre.netlify.app
```

**Panel Admin:**
```
https://tu-nombre.netlify.app/admin
```

**API Backend:**
```
https://web-netland.onrender.com
```

### 🔑 Credenciales por defecto:
```
Email:    admin@netland.com
Password: admin123
```

⚠️ **Cambia la contraseña inmediatamente**

---

## 🆘 Si algo no funciona

### El backend no responde
1. Ve a Render Dashboard → Logs
2. Busca errores
3. Verifica variables de entorno
4. Revisa que DATABASE_URL sea correcta

### El frontend muestra error de CORS
1. Actualiza CORS_ORIGINS en Render
2. Asegúrate de incluir `https://` en la URL
3. Espera a que Render se redesplegue

### No puedo hacer login
1. Verifica que ejecutaste `python -m app.seed`
2. Revisa que VITE_API_URL apunte a Render
3. Limpia cache del navegador (Ctrl + Shift + R)

---

## 📱 Próximos Pasos

### Configuración Recomendada:

1. **Dominio Personalizado**
   - Netlify → Domain settings → Add custom domain
   - Configura DNS de tu dominio

2. **Cambiar Credenciales**
   - Login como admin
   - Cambiar contraseña
   - Crear usuario personal

3. **Configurar Sitio**
   - Admin → Configuración
   - Agregar video hero
   - Configurar redes sociales

4. **Agregar Proyectos**
   - Admin → Proyectos → Nuevo
   - Subir imágenes y videos
   - Configurar lotes

5. **Monitoreo**
   - Activa notificaciones en Render
   - Revisa logs diariamente
   - Monitorea uso de Cloudinary

---

## 💡 Tips

### Para desarrollo local
Mantén las URLs de localhost en tu `.env` local

### Para actualizar el sitio
Solo haz push a `main`:
```bash
git add .
git commit -m "Actualización"
git push origin main
```
¡Render y Netlify se actualizarán automáticamente!

### Para ver logs
- **Render:** Dashboard → Tu servicio → Logs
- **Netlify:** Dashboard → Tu sitio → Deploys → Ver logs

---

¿Necesitas más ayuda? 👉 **[Ver guía completa](./DEPLOYMENT.md)**
