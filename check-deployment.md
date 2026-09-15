# ✅ Checklist de Pre-Despliegue

Usa este checklist antes de desplegar para asegurarte de que todo está listo.

## 🔍 Backend - Verificaciones

### 1. Archivos requeridos
- [ ] `backend/requirements.txt` existe
- [ ] `backend/render.yaml` existe
- [ ] `backend/.env.production.example` existe
- [ ] `backend/app/main.py` tiene endpoint `/api/health`

### 2. Variables de entorno necesarias
- [ ] `DATABASE_URL` - URL de Neon PostgreSQL
- [ ] `JWT_SECRET` - Clave secreta (mínimo 32 caracteres)
- [ ] `CLOUDINARY_CLOUD_NAME` - Cloud name de Cloudinary
- [ ] `CLOUDINARY_API_KEY` - API key de Cloudinary
- [ ] `CLOUDINARY_API_SECRET` - API secret de Cloudinary
- [ ] `FRONTEND_URL` - URL del frontend en Netlify
- [ ] `CORS_ORIGINS` - URLs permitidas para CORS

### 3. Base de datos (Neon)
- [ ] Proyecto creado en Neon
- [ ] Connection string disponible
- [ ] Base de datos accesible desde internet
- [ ] SSL mode habilitado

### 4. Cloudinary
- [ ] Cuenta creada y verificada
- [ ] Cloud name configurado
- [ ] API credentials disponibles
- [ ] Folders configurados: `projects/`, `site/`

### 5. Código listo
- [ ] Todos los cambios commiteados en Git
- [ ] Branch `main` actualizado
- [ ] `.env` NO está en Git (.gitignore correcto)
- [ ] Tests pasan (si existen)

---

## 🌐 Frontend - Verificaciones

### 1. Archivos requeridos
- [ ] `frontend/netlify.toml` existe
- [ ] `frontend/package.json` tiene script `build`
- [ ] `frontend/.env.production.example` existe
- [ ] `frontend/vite.config.ts` configurado

### 2. Variables de entorno necesarias
- [ ] `VITE_API_URL` - URL de la API en Render
- [ ] `VITE_WHATSAPP_NUMBER` - Número de WhatsApp

### 3. Build local funciona
- [ ] `npm install` sin errores
- [ ] `npm run build` genera carpeta `dist/`
- [ ] No hay errores TypeScript
- [ ] Tamaño de build razonable (<5MB)

### 4. Configuración
- [ ] Rutas correctamente configuradas
- [ ] Imágenes optimizadas
- [ ] Fuentes cargadas correctamente
- [ ] Favicon existe

### 5. Código listo
- [ ] Todos los cambios commiteados en Git
- [ ] Branch `main` actualizado
- [ ] `.env` NO está en Git (.gitignore correcto)
- [ ] URLs de desarrollo cambiadas a producción

---

## 🔗 Conexiones - Verificaciones

### 1. Git Repository
- [ ] Repositorio en GitHub/GitLab creado
- [ ] Código pusheado al repositorio
- [ ] Branch `main` es el principal
- [ ] `.gitignore` configurado correctamente

### 2. Cuentas necesarias
- [ ] Cuenta en Render.com creada
- [ ] Cuenta en Netlify.com creada
- [ ] Cuenta en Neon.tech activa
- [ ] Cuenta en Cloudinary activa

### 3. Permisos y accesos
- [ ] Render puede acceder al repositorio
- [ ] Netlify puede acceder al repositorio
- [ ] Todas las credenciales documentadas y guardadas
- [ ] 2FA activado en todas las cuentas (recomendado)

---

## 📝 Información para copiar

### Para Render (Backend):

**Build Command:**
```
pip install -r requirements.txt
```

**Start Command:**
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Root Directory:**
```
backend
```

**Health Check Path:**
```
/api/health
```

---

### Para Netlify (Frontend):

**Build Command:**
```
npm run build
```

**Publish Directory:**
```
dist
```

**Base Directory:**
```
frontend
```

---

## 🚀 Orden de Despliegue Recomendado

1. ✅ **Backend primero** (Render)
   - Así obtienes la URL de la API para configurar el frontend

2. ✅ **Frontend después** (Netlify)
   - Configuras VITE_API_URL con la URL de Render

3. ✅ **Actualizar CORS** (Render)
   - Agregas la URL de Netlify a CORS_ORIGINS

---

## 🆘 Si algo falla

### Backend no despliega
1. Revisa los logs en Render Dashboard
2. Verifica que `requirements.txt` tenga todas las dependencias
3. Asegúrate de que Python version sea 3.11
4. Verifica variables de entorno

### Frontend no despliega
1. Revisa los logs en Netlify Dashboard
2. Ejecuta `npm run build` localmente para ver errores
3. Verifica que Node version sea 18 o superior
4. Asegúrate de que las rutas sean correctas

### CORS errors
1. Agrega URL de Netlify a CORS_ORIGINS en Render
2. Asegúrate de incluir https:// en la URL
3. Redespliega el backend después de cambiar CORS
4. Limpia cache del navegador

### Base de datos no conecta
1. Verifica que DATABASE_URL sea correcta
2. Asegúrate de incluir `?sslmode=require`
3. Revisa que Neon esté activo (free tier puede hibernar)
4. Ejecuta las migraciones después del primer deploy

---

## ✨ Después del Despliegue

- [ ] Probar login de admin
- [ ] Crear usuario de prueba
- [ ] Subir un proyecto de prueba
- [ ] Subir imágenes y videos
- [ ] Probar formularios de contacto
- [ ] Verificar WhatsApp funciona
- [ ] Probar en móvil
- [ ] Configurar dominio personalizado (opcional)
- [ ] Configurar SSL (automático en Netlify)
- [ ] Monitorear logs por 24 horas

---

¡Buena suerte con el despliegue! 🚀
