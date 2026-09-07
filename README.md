# 🏡 Netland - Corporación Inmobiliaria

Sistema completo de gestión inmobiliaria con CRM, panel administrativo, módulo de cobranzas y sitio web público.

## 🌟 Características Principales

### 🌐 Sitio Web Público
- **Catálogo de proyectos** con filtros y búsqueda avanzada
- **Galería multimedia** con imágenes y videos institucionales
- **Planos interactivos** con disponibilidad en tiempo real de lotes
- **Calculadora de cuotas** con generación de PDF automática
- **Sistema de referidos** ("Refiere y Gana") con recompensas por niveles
- **Formularios de contacto** con captura automática de leads
- **WhatsApp flotante** integrado en todas las páginas
- **Diseño responsive** optimizado para móvil, tablet y desktop
- **SEO optimizado** para motores de búsqueda
- **Carga rápida** con lazy loading y optimización de imágenes

### 🔧 Panel Administrativo CRM

#### Gestión Comercial
- **Dashboard con KPIs** en tiempo real
- **Gestión de Proyectos** completa con galería y documentos
- **Gestión de Lotes** con importación masiva desde Excel
- **CRM de Leads** con estados de seguimiento y asignación de asesores
- **Clientes Captados** con historial completo
- **Sistema de Cotizaciones** con generación y envío de PDF
- **Gestión de Visitas** con calendario integrado
- **Gestión de Asesores** con perfil público en la web
- **Promociones** con fechas de vigencia
- **Multimedia** centralizada con Cloudinary CDN

#### Módulo de Propietarios y Cobranzas 💰
- **Gestión de Propietarios** (persona natural y jurídica)
- **Contratos de Compra-Venta** con numeración automática
- **Copropiedades** (múltiples propietarios por lote)
- **Modalidades de Pago:**
  - Al Contado (pago único o sin interés)
  - Financiado (cuotas con cronograma)
- **Registro de Pagos** con múltiples métodos
- **Dashboard de Cobranzas** con indicadores:
  - Cartera total
  - Total cobrado
  - Pendiente por cobrar
  - Deuda vencida
  - Cobranzas del mes
  - Próximos vencimientos
- **Semáforo de Cobranza** (Al día, Próximo a vencer, Vencido)
- **Integración WhatsApp** para recordatorios de pago
- **Reportes y Estados de Cuenta**
- **Control de Mora** automático con alertas

#### Seguridad y Control
- **Autenticación JWT** con roles y permisos
- **Roles de Usuario:** SUPER_ADMIN, ADMIN, ASESOR
- **Auditoría completa** de acciones (quién y cuándo)
- **Gestión de Usuarios** con control de accesos

## 🛠️ Stack Tecnológico

### Backend (API)
- **FastAPI** 0.104+ - Framework web moderno y rápido
- **PostgreSQL** (Neon) - Base de datos relacional en la nube
- **SQLAlchemy** 2.0+ - ORM con soporte async
- **Alembic** - Sistema de migraciones de BD
- **Pydantic** v2 - Validación de datos
- **Cloudinary** - CDN y almacenamiento de archivos
- **JWT** - Autenticación y autorización
- **Python** 3.11+

### Frontend (Web App)
- **React** 18 - Librería UI con hooks
- **TypeScript** 5+ - Tipado estático
- **Vite** - Build tool ultra rápido
- **TanStack Query** (React Query) - Data fetching y cache
- **React Router** v6 - Navegación SPA
- **Tailwind CSS** 3+ - Framework de estilos utility-first
- **Lucide Icons** - Iconografía moderna
- **jsPDF** - Generación de PDFs
- **Recharts** - Gráficos y visualizaciones

### Infraestructura y DevOps
- **Render.com** - Hosting del backend
- **Netlify** - Hosting del frontend con CDN global
- **Neon PostgreSQL** - Base de datos serverless
- **Cloudinary** - CDN de medios (imágenes, videos, PDFs)
- **Git** + **GitHub** - Control de versiones
- **HTTPS** - Certificados SSL automáticos

## 📦 Estructura del Proyecto

```
netland-proyecto/
├── backend/                      # API REST con FastAPI
│   ├── app/
│   │   ├── api/
│   │   │   ├── router.py        # Router principal
│   │   │   └── routes/          # Endpoints por módulo
│   │   │       ├── auth.py
│   │   │       ├── projects.py
│   │   │       ├── lots.py
│   │   │       ├── leads.py
│   │   │       ├── clients.py
│   │   │       ├── quotes.py
│   │   │       ├── visits.py
│   │   │       ├── owners.py    # Módulo propietarios
│   │   │       ├── contracts.py # Módulo contratos
│   │   │       ├── payments.py  # Módulo pagos
│   │   │       └── collections.py # Módulo cobranzas
│   │   ├── core/
│   │   │   ├── config.py        # Configuración
│   │   │   ├── database.py      # Conexión a BD
│   │   │   ├── dependencies.py  # Dependencias FastAPI
│   │   │   ├── logging.py       # Sistema de logs
│   │   │   └── security.py      # JWT y hashing
│   │   ├── domain/
│   │   │   ├── models.py        # Modelos SQLAlchemy principales
│   │   │   └── owners_models.py # Modelos del módulo de cobranzas
│   │   ├── infrastructure/
│   │   │   ├── cloudinary_service.py
│   │   │   ├── pdf_service.py
│   │   │   ├── owners_service.py     # Lógica de negocio cobranzas
│   │   │   └── plan_analyzer/        # OCR y detección de lotes
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── project.py
│   │   │   ├── crm.py
│   │   │   ├── owners.py        # Schemas de cobranzas
│   │   │   └── ...
│   │   ├── main.py              # Punto de entrada
│   │   └── seed.py              # Datos iniciales
│   ├── alembic/
│   │   ├── versions/            # Migraciones de BD
│   │   └── env.py
│   ├── tests/                   # Tests unitarios
│   ├── requirements.txt         # Dependencias Python
│   ├── alembic.ini
│   ├── render.yaml              # Config Render.com
│   ├── .env.example
│   └── OWNERS_MODULE_README.md  # Documentación módulo cobranzas
│
├── frontend/                    # SPA con React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # Navbar, Footer, etc.
│   │   │   └── ui/             # Componentes reutilizables
│   │   │       ├── CoreSpinLoader.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Toast.tsx
│   │   │       └── ...
│   │   ├── features/
│   │   │   ├── admin/
│   │   │   │   ├── AdminLayout.tsx
│   │   │   │   ├── AuthContext.tsx
│   │   │   │   ├── ui.tsx      # Componentes UI admin
│   │   │   │   └── pages/      # Páginas del admin
│   │   │   │       ├── Dashboard.tsx
│   │   │   │       ├── Projects.tsx
│   │   │   │       ├── Lots.tsx
│   │   │   │       ├── Leads.tsx
│   │   │   │       ├── Quotes.tsx
│   │   │   │       └── ...
│   │   │   └── owners/         # Módulo de cobranzas
│   │   │       ├── types.ts
│   │   │       ├── constants.ts
│   │   │       └── pages/
│   │   │           ├── CollectionsPage.tsx
│   │   │           ├── OwnersPage.tsx
│   │   │           ├── ContractsPage.tsx
│   │   │           └── PaymentsPage.tsx
│   │   ├── pages/              # Páginas públicas
│   │   │   ├── Home.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── ProjectDetail.tsx
│   │   │   ├── Advisors.tsx
│   │   │   ├── ReferAndEarn.tsx
│   │   │   ├── Contact.tsx
│   │   │   └── About.tsx
│   │   ├── lib/
│   │   │   ├── api.ts          # Cliente HTTP
│   │   │   └── constants.ts    # Constantes globales
│   │   ├── types/              # TypeScript types
│   │   ├── App.tsx             # Router principal
│   │   └── main.tsx            # Punto de entrada
│   ├── public/
│   │   ├── logo-netland.png
│   │   ├── plantilla-lotes.csv
│   │   └── _redirects          # Netlify redirects
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── netlify.toml            # Config Netlify
│   └── .env.example
│
├── docker/
│   └── docker-compose.yml      # Docker para desarrollo local
│
├── .git/                       # Control de versiones
├── .gitignore
├── README.md                   # Este archivo
├── DEPLOYMENT.md               # Guía completa de despliegue
├── check-deployment.md         # Checklist pre-deploy
├── PRESENTACION_PROYECTO_NETLAND.md  # Documento ejecutivo
└── MANUAL_USUARIO_SISTEMA_NETLAND.md # Manual de usuario
```

## 🚀 Despliegue en Producción

### Backend → Render
```bash
# Ver guía completa en DEPLOYMENT.md

1. Push código a GitHub/GitLab
2. Crear Web Service en Render
3. Configurar variables de entorno
4. Deploy automático
```

### Frontend → Netlify
```bash
# Ver guía completa en DEPLOYMENT.md

1. Push código a GitHub/GitLab
2. Importar proyecto en Netlify
3. Configurar variables de entorno
4. Deploy automático
```

👉 **[Ver guía completa de despliegue](./DEPLOYMENT.md)**

## 💻 Desarrollo Local

### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Configurar .env (copiar de .env.example)
cp .env.example .env

# Ejecutar migraciones
alembic upgrade head

# Crear datos iniciales
python -m app.seed

# Iniciar servidor
uvicorn app.main:app --reload
```

Backend disponible en: http://localhost:8000
Documentación API: http://localhost:8000/docs

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar .env (copiar de .env.example)
cp .env.example .env

# Iniciar servidor de desarrollo
npm run dev
```

Frontend disponible en: http://localhost:5173

## 🔐 Credenciales por Defecto

Después de ejecutar `python -m app.seed`:

**Super Admin:**
- Email: `admin@netland.com`
- Password: `admin123`
- Acceso: Completo a todos los módulos

**Admin:**
- Email: `admin2@netland.com`
- Password: `admin123`
- Acceso: Gestión comercial y cobranzas

**Asesor:**
- Email: `asesor@netland.com`
- Password: `asesor123`
- Acceso: Leads, cotizaciones y visitas asignadas

⚠️ **IMPORTANTE:** 
- Cambiar estas contraseñas inmediatamente en producción
- Usar contraseñas seguras con al menos 12 caracteres
- Activar 2FA si está disponible

## 📚 Documentación del Proyecto

### Documentos Principales
- **[README.md](./README.md)** - Este archivo (overview general)
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Guía completa de despliegue en producción
- **[check-deployment.md](./check-deployment.md)** - Checklist de verificación pre-deploy
- **[PRESENTACION_PROYECTO_NETLAND.md](./PRESENTACION_PROYECTO_NETLAND.md)** - Documento ejecutivo para presentación
- **[MANUAL_USUARIO_SISTEMA_NETLAND.md](./MANUAL_USUARIO_SISTEMA_NETLAND.md)** - Manual de usuario del sistema

### Documentación Técnica Específica
- **[backend/OWNERS_MODULE_README.md](./backend/OWNERS_MODULE_README.md)** - Documentación del módulo de cobranzas
- **[backend/sql_examples.sql](./backend/sql_examples.sql)** - Ejemplos de consultas SQL
- **[backend/PLAN_IMPORT_SETUP.md](./backend/PLAN_IMPORT_SETUP.md)** - Setup de importación de planos

### API Documentation
- **Swagger UI:** `http://localhost:8000/docs` (desarrollo)
- **ReDoc:** `http://localhost:8000/redoc` (documentación alternativa)
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

### Diagramas y Recursos
- Diagrama de arquitectura (en documento de presentación)
- Diagrama de base de datos (en módulo owners)
- Flujos de usuario (en manual de usuario)

## 🗃️ Base de Datos

El proyecto usa **Neon PostgreSQL** (serverless y compatible con Render, Netlify y desarrollo local).

### Tablas Principales

#### Módulo CRM
- `users` - Usuarios del sistema (admin, asesores)
- `projects` - Proyectos inmobiliarios
- `blocks` - Manzanas de los proyectos
- `lots` - Lotes disponibles
- `project_images` - Galería de imágenes
- `project_videos` - Videos promocionales
- `project_documents` - Documentos descargables
- `leads` - Leads capturados
- `clients` - Clientes registrados
- `quotes` - Cotizaciones generadas
- `visits` - Visitas programadas
- `advisors` - Asesores de ventas
- `promotions` - Promociones activas

#### Módulo de Propietarios y Cobranzas
- `owners` - Propietarios (extensión de clients)
- `contracts` - Contratos de compra-venta
- `property_ownerships` - Copropiedades (N:M owners-lots)
- `cash_payments` - Pagos al contado
- `financing_plans` - Planes de financiamiento
- `installments` - Cuotas del cronograma
- `payments` - Pagos realizados
- `payment_allocations` - Distribución de pagos a cuotas
- `contract_documents` - Documentos del contrato
- `import_batches` - Lotes de importación Excel
- `import_errors` - Errores de importación

**Total:** 25+ tablas normalizadas (3FN)

### Migraciones

```bash
# Crear nueva migración
cd backend
alembic revision --autogenerate -m "descripción del cambio"

# Aplicar todas las migraciones pendientes
alembic upgrade head

# Revertir última migración
alembic downgrade -1

# Ver historial de migraciones
alembic history

# Ver estado actual
alembic current
```

### Diagrama ER Simplificado

```
User (auth)
  ↓
Advisor → Leads → Clients → Quotes
  ↓         ↓        ↓        ↓
Project → Lots  ← Visits   Contracts → Owners
  ↓         ↓                  ↓
Blocks   PropertyOwnership    FinancingPlan → Installments
                               ↓                   ↓
                           CashPayment       Payments → PaymentAllocations
```

## 📤 Cloudinary

El sistema usa Cloudinary para almacenar:
- Imágenes de proyectos
- Videos promocionales
- Documentos PDF
- Planos interactivos

Folders organizados:
- `projects/{proyecto_slug}/gallery/`
- `projects/{proyecto_slug}/videos/`
- `projects/{proyecto_slug}/documents/`
- `site/hero/`

## 🧪 Testing

### Backend
```bash
cd backend

# Instalar dependencias de testing
pip install pytest pytest-asyncio httpx

# Ejecutar todos los tests
pytest

# Ejecutar con coverage
pytest --cov=app tests/

# Ejecutar tests específicos
pytest tests/test_integration.py
pytest tests/test_owners_module.py

# Tests con output detallado
pytest -v
```

### Frontend
```bash
cd frontend

# Ejecutar tests
npm run test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch

# Tests e2e (si están configurados)
npm run test:e2e
```

### Tests Manuales
```bash
# Test de módulo de propietarios
cd backend
python test_owners_module.py

# Test de OCR setup
python test_ocr_setup.py
```

## 📊 Monitoreo y Logs

### Producción
- **Backend (Render):** Dashboard → Logs (tiempo real)
- **Frontend (Netlify):** Dashboard → Deploys → Deploy logs
- **Database (Neon):** Dashboard → Monitoring → Queries, Connections
- **Cloudinary:** Dashboard → Usage → Bandwidth, Storage

### Métricas Clave
- ⚡ Tiempo de respuesta de API (objetivo: <200ms)
- 🔴 Errores 5xx en backend (objetivo: 0%)
- 📈 Tasa de conversión de leads (objetivo: >30%)
- 💾 Uso de base de datos (límite: según plan)
- 🖼️ Uso de ancho de banda Cloudinary (límite: según plan)
- 👥 Usuarios activos concurrentes

### Logs del Sistema
```bash
# Backend local
tail -f logs/app.log

# Render (producción)
# Ver en dashboard o usar Render CLI

# Netlify (producción)
# Ver en dashboard, sección Functions
```

### Alertas Recomendadas
- Error rate > 1%
- Tiempo de respuesta > 500ms
- Uso de DB > 80%
- Uso de Cloudinary > 90%
- Down time del servicio

## 🤝 Contribuir

### Workflow de Desarrollo
1. **Fork** el proyecto
2. Crea una **rama feature**: `git checkout -b feature/nueva-funcionalidad`
3. **Commit** tus cambios: `git commit -m 'feat: agregar nueva funcionalidad'`
4. **Push** a la rama: `git push origin feature/nueva-funcionalidad`
5. Abre un **Pull Request** con descripción detallada

### Convenciones de Código

#### Commits (Conventional Commits)
```
feat: nueva funcionalidad
fix: corrección de bug
docs: cambios en documentación
style: formateo, punto y coma faltante, etc
refactor: refactorización de código
test: agregar tests
chore: actualizar dependencias, configs
```

#### Python (Backend)
- Seguir **PEP 8**
- Usar **type hints** en funciones
- Docstrings para funciones públicas
- Max line length: 100 caracteres
- Usar **Black** para formateo automático

#### TypeScript (Frontend)
- Seguir **ESLint** config del proyecto
- Usar **TypeScript strict mode**
- Componentes funcionales con hooks
- Props con interfaces tipadas
- Usar **Prettier** para formateo

### Code Review Checklist
- [ ] Tests pasando
- [ ] Sin errores de linting
- [ ] Documentación actualizada
- [ ] Variables de entorno documentadas
- [ ] Migraciones incluidas (si aplica)
- [ ] Performance considerado
- [ ] Seguridad revisada

## 📝 Licencia

Este proyecto es privado y propiedad de **Corporación Inmobiliaria Netland**.

Todos los derechos reservados © 2026 Netland.

## 🚧 Roadmap y Mejoras Futuras

### ✅ Completado (v1.0)
- [x] Sitio web público responsive
- [x] CRM completo (leads, clientes, cotizaciones)
- [x] Gestión de proyectos y lotes
- [x] Planos interactivos
- [x] Calculadora de cuotas con PDF
- [x] Sistema de referidos
- [x] Módulo de propietarios y cobranzas
- [x] Dashboard de KPIs
- [x] Roles y permisos
- [x] Integración WhatsApp

### 🔄 En Desarrollo (v1.1)
- [ ] Importación de propietarios desde Excel
- [ ] Generación de contratos PDF
- [ ] Estados de cuenta PDF
- [ ] Notificaciones por email automatizadas
- [ ] Reportes avanzados de cobranzas

### 📋 Planeado (v2.0)
- [ ] App móvil para asesores (React Native)
- [ ] Firma digital de contratos
- [ ] Portal del cliente (ver su estado de cuenta)
- [ ] Integración con pasarelas de pago online
- [ ] Chat en vivo en el sitio web
- [ ] Sistema de tickets de soporte
- [ ] Integración con ERP contable
- [ ] Business Intelligence (BI) dashboards
- [ ] Email marketing automatizado
- [ ] Sistema de comisiones para asesores

### 💡 Ideas Futuras
- [ ] Realidad aumentada para visualizar lotes
- [ ] Tour virtual 360° de proyectos
- [ ] Integración con Google Calendar
- [ ] Webhooks para integraciones
- [ ] API pública documentada
- [ ] Marketplace de servicios adicionales
- [ ] Sistema de referidos multinivel

## 📞 Contacto y Soporte

### Netland Corporación Inmobiliaria
- **Website:** https://netland.com.pe
- **Email Comercial:** ventas@netland.com
- **Email Soporte:** soporte@netland.com
- **WhatsApp:** +51 985 928 062
- **Oficina:** Cañete, Lima - Perú

### Soporte Técnico
- **Email:** admin@netland.com
- **Horario:** Lunes a Viernes, 9:00 AM - 6:00 PM (GMT-5)
- **Tiempo de respuesta:** 24-48 horas hábiles

### Redes Sociales
- **Facebook:** /NetlandInmobiliaria
- **Instagram:** @netland.inmobiliaria
- **LinkedIn:** /company/netland

### Para Desarrolladores
- **GitHub:** [repositorio privado]
- **Documentación:** Ver carpeta `/docs`
- **Issues:** Reportar en GitHub Issues
- **Contribuciones:** Ver sección "Contribuir"

---

**🏡 Hecho con ❤️ por el equipo de Netland**

*Sistema desarrollado para modernizar y optimizar las operaciones comerciales de Corporación Inmobiliaria Netland.*

---

## 🎓 Créditos

### Tecnologías de Código Abierto
- React, FastAPI, PostgreSQL, Tailwind CSS y todas las librerías utilizadas
- Agradecimiento a la comunidad open source

### Servicios en la Nube
- Render.com (Hosting backend)
- Netlify (Hosting frontend)
- Neon (PostgreSQL)
- Cloudinary (CDN de medios)

---

**Versión:** 1.0.0  
**Última actualización:** Septiembre 2026  
**Estado:** ✅ En Producción
