# 🚀 Guía de Despliegue - Netland

Esta guía te llevará paso a paso para desplegar tu aplicación en producción.

---

## 📋 Requisitos previos

- ✅ Base de datos PostgreSQL en Neon (ya configurada)
- ✅ Cuenta en Cloudinary (ya configurada)
- 🆕 Cuenta en [Render](https://render.com) (para el backend)
- 🆕 Cuenta en [Netlify](https://netlify.com) (para el frontend)

---

## 🔧 PARTE 1: Desplegar Backend en Render

### Paso 1: Preparar el repositorio

1. **Asegúrate de que todos los cambios estén en Git:**
   ```bash
   cd backend
   git add .
   git commit -m "Preparar para despliegue en Render"
   git push origin main
   ```

### Paso 2: Crear servicio en Render

1. Ve a [Render Dashboard](https://dashboard.render.com/)
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub/GitLab
4. Configura el servicio:

   **Build & Deploy:**
   - **Name:** `netland-backend`
   - **Region:** Oregon (US West) o la más cercana
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

   **Plan:**
   - Selecciona **"Free"** para empezar (puedes actualizar después)

5. Click en **"Advanced"** y agrega las variables de entorno:

### Paso 3: Configurar Variables de Entorno en Render

Agrega estas variables de entorno (Environment Variables):

```
DATABASE_URL=postgresql://usuario:password@host/database
```
👉 **Obtener de Neon:** Ve a tu proyecto en Neon → Connection String

```
SECRET_KEY=tu_clave_secreta_super_segura_cambiala_ahora
```
👉 **Generar una nueva:** Usa un generador de passwords seguro (mínimo 32 caracteres)

```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```
👉 **Obtener de Cloudinary:** Dashboard → Account Details

```
FRONTEND_URL=https://tu-sitio.netlify.app
```
👉 **Nota:** Agregarás esta URL después de desplegar el frontend

```
CORS_ORIGINS=https://tu-sitio.netlify.app,http://localhost:5173
```
👉 **Nota:** Agregarás la URL de Netlify después

### Paso 4: Desplegar

1. Click en **"Create Web Service"**
2. Render comenzará a construir y desplegar tu backend
3. Espera a que el estado sea **"Live"** (toma 2-5 minutos)
4. Copia la URL de tu backend: `https://web-netland.onrender.com`

### Paso 5: Ejecutar migraciones

Después del primer despliegue, ejecuta las migraciones:

1. En el dashboard de Render, ve a tu servicio
2. Click en **"Shell"** en el menú lateral
3. Ejecuta:
   ```bash
   alembic upgrade head
   python -m app.seed
   ```

✅ **Backend desplegado!** URL: `https://web-netland.onrender.com`

---

## 🌐 PARTE 2: Desplegar Frontend en Netlify

### Paso 1: Preparar el frontend

1. **Actualiza la URL del backend en el archivo de entorno:**
   ```bash
   cd frontend
   ```

2. **Crea/actualiza `.env.production`:**
   ```env
   VITE_API_URL=https://web-netland.onrender.com/api
   VITE_WHATSAPP_NUMBER=51985928062
   ```

3. **Commit los cambios:**
   ```bash
   git add .
   git commit -m "Configurar para producción"
   git push origin main
   ```

### Paso 2: Desplegar en Netlify

#### Opción A: Deploy desde Git (Recomendado)

1. Ve a [Netlify](https://app.netlify.com/)
2. Click en **"Add new site"** → **"Import an existing project"**
3. Conecta tu repositorio de GitHub/GitLab
4. Configura el sitio:

   **Build settings:**
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`

5. Click en **"Show advanced"** y agrega variables de entorno:
   ```
   VITE_API_URL=https://web-netland.onrender.com/api
   VITE_WHATSAPP_NUMBER=51985928062
   ```

6. Click en **"Deploy site"**

#### Opción B: Deploy manual (más rápido)

1. **Construye el proyecto localmente:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Instala Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

3. **Login en Netlify:**
   ```bash
   netlify login
   ```

4. **Despliega:**
   ```bash
   netlify deploy --prod
   ```
   - Cuando pregunte por el "publish directory", escribe: `dist`

### Paso 3: Configurar dominio personalizado (Opcional)

1. En Netlify, ve a **"Site settings"** → **"Domain management"**
2. Click en **"Add custom domain"**
3. Sigue las instrucciones para configurar tu dominio

✅ **Frontend desplegado!** URL: `https://tu-sitio.netlify.app`

---

## 🔄 PARTE 3: Conectar Backend y Frontend

### Actualizar CORS en el Backend

1. Ve a Render Dashboard → Tu servicio backend
2. Ve a **"Environment"**
3. Actualiza estas variables:
   ```
   FRONTEND_URL=https://tu-sitio.netlify.app
   CORS_ORIGINS=https://tu-sitio.netlify.app,http://localhost:5173
   ```
4. El servicio se redesplegará automáticamente

### Verificar que todo funciona

1. Abre tu sitio: `https://tu-sitio.netlify.app`
2. Prueba:
   - ✅ Navegar por las páginas
   - ✅ Ver proyectos
   - ✅ Login en admin
   - ✅ Subir imágenes/videos

---

## 📊 Monitoreo y Mantenimiento

### Render (Backend)

- **Ver logs:** Dashboard → Tu servicio → "Logs"
- **Reiniciar:** Dashboard → Tu servicio → "Manual Deploy" → "Clear build cache & deploy"
- **Escalado:** Free tier duerme después de 15 min de inactividad. Considera Starter ($7/mes) para evitarlo.

### Netlify (Frontend)

- **Ver deploys:** Dashboard → Tu sitio → "Deploys"
- **Revertir:** Click en cualquier deploy anterior → "Publish deploy"
- **Analytics:** Dashboard → Tu sitio → "Analytics"

---

## 🚨 Troubleshooting

### Backend no responde (500 error)

1. Verifica las variables de entorno en Render
2. Revisa los logs en Render Dashboard
3. Verifica que DATABASE_URL sea correcta
4. Ejecuta migraciones si es necesario

### Frontend muestra errores de CORS

1. Verifica que FRONTEND_URL esté configurada en Render
2. Verifica que CORS_ORIGINS incluya tu URL de Netlify
3. Redespliega el backend después de cambiar variables

### Imágenes no se suben

1. Verifica credenciales de Cloudinary en Render
2. Verifica que el usuario admin tenga permisos
3. Revisa los logs del backend

### Base de datos desconectada

1. Verifica que Neon esté activo
2. Verifica DATABASE_URL en Render
3. Neon free tier puede hibernar, actívalo desde su dashboard

---

## 💰 Costos Estimados

### Plan Gratuito (para empezar):
- **Render Free:** $0/mes (con limitaciones)
- **Netlify Free:** $0/mes (100GB bandwidth)
- **Neon Free:** $0/mes (3GB storage)
- **Cloudinary Free:** $0/mes (25 GB almacenamiento, 25 GB bandwidth)

**Total: $0/mes** ⚠️ Backend duerme tras 15 min de inactividad

### Plan Recomendado (producción):
- **Render Starter:** $7/mes (siempre activo)
- **Netlify Free:** $0/mes
- **Neon Scale:** $19/mes (mejor rendimiento)
- **Cloudinary Free:** $0/mes

**Total: ~$26/mes** ✅ Servicio profesional y estable

---

## ✅ Checklist de Despliegue

### Pre-despliegue
- [ ] Base de datos en Neon configurada
- [ ] Cloudinary configurado
- [ ] Código en Git actualizado
- [ ] Variables de entorno documentadas

### Backend (Render)
- [ ] Servicio creado en Render
- [ ] Variables de entorno configuradas
- [ ] Build exitoso
- [ ] Migraciones ejecutadas
- [ ] Usuario admin creado
- [ ] Health check respondiendo

### Frontend (Netlify)
- [ ] Sitio creado en Netlify
- [ ] Variables de entorno configuradas
- [ ] Build exitoso
- [ ] Dominio configurado (si aplica)
- [ ] HTTPS activo

### Post-despliegue
- [ ] CORS configurado correctamente
- [ ] Login de admin funciona
- [ ] Subida de archivos funciona
- [ ] Todos los proyectos visibles
- [ ] WhatsApp funciona
- [ ] Videos se reproducen

---

## 🎉 ¡Listo!

Tu aplicación Netland está ahora en producción y accesible desde cualquier lugar del mundo.

**URLs importantes:**
- 🌐 Sitio público: `https://tu-sitio.netlify.app`
- 🔧 Panel admin: `https://tu-sitio.netlify.app/admin`
- 🔌 API Backend: `https://web-netland.onrender.com`

---

## 📞 Soporte

Si tienes problemas con el despliegue:
1. Revisa los logs en Render y Netlify
2. Verifica todas las variables de entorno
3. Consulta la documentación oficial:
   - [Render Docs](https://render.com/docs)
   - [Netlify Docs](https://docs.netlify.com)
