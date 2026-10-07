# Innovia Hub

Innovia Hub är ett bokningssystem för delade resurser (t.ex. mötesrum, skrivbord och annan utrustning) på ett kontor/coworking-hub. Systemet består av ett .NET-backend-API, en React-frontend och realtidsuppdateringar via SignalR, och körs i produktion som Docker-containrar bakom Caddy.

## Innehåll

- [Teknikstack](#teknikstack)
- [Arkitektur och designval](#arkitektur-och-designval)
- [AI-bokningsassistent](#ai-bokningsassistent)
- [Projektstruktur](#projektstruktur)
- [Domänmodell](#domänmodell)
- [Kom igång lokalt](#kom-igång-lokalt)
- [Miljövariabler](#miljövariabler)
- [Tester](#tester)
- [CI/CD och deploy](#cicd-och-deploy)
- [API-dokumentation (Scalar)](#api-dokumentation-scalar)
- [Säkerhet](#säkerhet)

## Teknikstack

**Backend**
- .NET 10 / ASP.NET Core Minimal API
- Entity Framework Core + Npgsql (PostgreSQL)
- ASP.NET Core Identity (användare, roller, lösenordshantering)
- JWT-autentisering, förvarat i `HttpOnly`-cookies
- SignalR för realtidsuppdateringar (bokningar och resursstatus)
- Scalar för interaktiv OpenAPI-dokumentation

**Frontend**
- React 19 + TypeScript + Vite
- React Router för routing
- TanStack Query för server state/caching
- Tailwind CSS för styling
- @microsoft/signalr för realtidsanslutning mot backend
- Recharts för diagram (t.ex. beläggning/occupancy)

**Infrastruktur**
- PostgreSQL 17 i Docker
- Caddy som reverse proxy + automatisk HTTPS i produktion
- Docker Compose för lokal utveckling och produktion
- GitHub Actions för CI (build/test/lint) och CD (bygg + push till GHCR + deploy via SSH)

## Arkitektur och designval


### Backend: Vertical Slice Architecture

Backend är byggt som **vertical slices** (feature folders) istället för traditionella lager (Controllers/Services/Repositories rakt igenom). Varje funktion ligger i sin egen mapp under `Innovia.Api/Features/`, t.ex. `Features/Bookings/CreateBooking/`, och innehåller allt som hör till just den use-caset:

- `*.Endpoint.cs` – definierar route, kopplar HTTP-request till handler, mappar `Result` till HTTP-svar
- `*.Command.cs` / `*.Request.cs` – indata till use-caset
- `*.Handler.cs` – själva affärslogiken
- `*.Validator.cs` – validering av indata
- `*.Response.cs` – DTO som skickas tillbaka (aldrig entiteter direkt)

Varje feature-mapp har en `*ServiceExtensions.cs` (t.ex. `BookingServiceExtensions.cs`) som registrerar DI och mappar endpoints (`MapBookingsEndpoints()`), och dessa anropas samlat från `Program.cs`. Detta gör att auktorisering (`RequireAuthorization`, roll-policys) är samlad och synlig på ett ställe per feature, istället för utspridd i enskilda filer.

**Varför:** Vertical slices minskar kopplingen mellan orelaterade funktioner (att ändra bokningslogik rör inte resurslogik) och gör det lätt att hitta all kod som hör till en viss funktion, på bekostnad av viss duplicering mellan slices.

### Result-pattern istället för exceptions

Handlers returnerar `Result` / `Result<T>` (se `Common/Result/`) istället för att kasta exceptions för förväntade felfall (t.ex. "bokning finns inte", "resurs redan bokad"). `ToHttpResponse()` mappar sedan resultatet till rätt HTTP-status/`ProblemDetails`. Detta ger explicit, förutsägbar felhantering och undviker att använda exceptions för kontrollflöde.

### Autentisering och auktorisering

- Inloggning sker mot ASP.NET Core Identity (`UserManager`/`SignInManager`), med lösenordslåsning (lockout) vid upprepade felaktiga inloggningsförsök.
- Vid lyckad inloggning utfärdas en **JWT access token** (kort livslängd, default 15 min) och en **refresh token** (roterande, hash:as vid lagring, default 1 dag). Båda skickas som separata `HttpOnly`-cookies, inte i JSON-svaret – detta skyddar mot att tokens läses av JavaScript (XSS). Frontendens API-klient fångar 401 pga utgången access token och anropar `/auth/refresh` automatiskt innan requesten görs om, så kort livslängd på access token märks inte av användaren.
- Cookies sätts med `SameSite=Strict` och `Secure` (i produktion), vilket skyddar mot CSRF utan att behöva separata CSRF-tokens.
- Refresh tokens roteras vid varje användning; om en redan använd/återkallad refresh token återanvänds så återkallas hela tokenfamiljen (skydd mot replay-attacker om en token skulle läcka).
- Auktorisering styrs via policys (`AdminOnly`, `MemberOnly`, `MemberOrAdmin`, se `Common/Auth/AuthorizationPolicies.cs`) och en **fallback-policy som kräver autentisering** på alla endpoints som inte uttryckligen är anonyma. Admin-only-anrop kontrolleras dessutom explicit i handlers där en admin kan agera å en annan användares vägnar (t.ex. skapa bokning åt någon annan).
- SignalR-hubbarna (`/hubs/bookings`, `/hubs/resources`) kräver också autentisering, med extra admin-policy på de metoder som strömmar all bokningsdata.

### Realtid (SignalR)

Två hubbar sänder ut händelser till klienter som prenumererar:
- `BookingHub` – bokningar skapas/uppdateras/avbokas, samt en admin-grupp som får alla bokningshändelser.
- `ResourceHub` – ändringar i resursstatus (t.ex. offline/underhåll).

Frontend ansluter till dessa via `@microsoft/signalr` (se `frontend/src/lib/bookingHubConnection.ts` och `resourceHubConnection.ts`) för att slippa pollning.

### AI-bokningsassistent

Hyresgäster kan skriva vad de behöver på vanlig svenska, till exempel "mötesrum i morgon klockan 14", och få förslag på lediga resurser som de bokar med ett klick. Assistenten ligger som en egen feature i `Innovia.Api/Features/Assistant/` och följer samma vertical slice-struktur som övriga features.

**Flöde**

1. Frontendens chattpanel (på sidan Resurser) skickar meddelandet till `POST /assistant`. Endpointen kräver inloggning (`MemberOrAdmin`).
2. `Validator` stoppar tomma meddelanden och meddelanden över 500 tecken innan något skickas vidare, eftersom varje anrop kostar token.
3. `Handler` anropar OpenAI (Responses API) med dagens datum och en beskrivning av verktyget `sokLedigaResurser`.
4. Modellen tolkar önskemålet och ber om en sökning. `ResourceSearchTool` kör den mot databasen via den befintliga tillgänglighetslogiken (`GetResourceAvailability`) och resultatet skickas tillbaka till modellen. Antalet verktygsrundor är begränsat till 4 per fråga.
5. Modellen registrerar sina förslag via verktyget `foreslaBokning`. Varje förslag kontrolleras mot de tider sökningen faktiskt gav, så modellen kan inte föreslå ett rum eller en tid som inte finns.
6. Svaret innehåller en text och en lista med förslag:

```json
{
  "reply": "I morgon kl. 14:00 är Mötesrum 2 och 3 lediga. Du bokar med knappen.",
  "suggestions": [
    {
      "resourceId": "…",
      "resourceName": "Mötesrum 2",
      "startsAt": "2026-10-07T12:00:00+00:00",
      "endsAt": "2026-10-07T13:00:00+00:00"
    }
  ]
}
```

7. Boka-knappen i panelen anropar den vanliga bokningsendpointen (`POST /bookings`), så alla bokningsregler gäller, och bokningen syns i "Mina bokningar".

**Fullbokat-alternativ:** när inget är ledigt vid önskad tid letar sökningen först andra tider samma dag och därefter närmaste dag med lediga tider (upp till 7 dagar fram). Alternativen returneras i fältet `alternativ`.

**Designval**

- **AI:n bokar aldrig själv.** Bokningen sker bara när användaren klickar, vilket också stämmer med kraven på transparens i EU:s AI-förordning och GDPR.
- Fel hanteras med `Result`/`Error` som i övriga features. OpenAI:s råa felmeddelanden loggas på servern men skickas inte till klienten.
- Tider skickas i UTC (`+00:00`), eftersom PostgreSQL endast accepterar offset 0. Modellen får tiderna omräknade till svensk tid.

### Frontend

- **React Router** delar upp gränssnittet i member- och admin-sidor (`src/pages/member`, `src/pages/admin`), med `ProtectedRoute` som skyddar routes baserat på inloggnings-/rollstatus.
- **TanStack Query** hanterar all server state (hämtning, cache, refetch, mutationer) mot API:et istället för manuell `useState`/`useEffect`-hantering av data.
- **API-klienten** (`src/api/client.ts`) gör alla anrop med `credentials: "include"` så att autentiseringscookies alltid skickas med, utan att JS behöver hantera tokens direkt.
- Tailwind CSS används för styling utan separat komponentbibliotek.

### Datalager

- EF Core mot PostgreSQL, med migrations incheckade i `Innovia.Api/Migrations/`.
- Migrations körs automatiskt vid uppstart (`ApplyMigrationsAsync`), och grunddata (t.ex. admin-användare, roller) seedas via `SeedAppDataAsync`.
- Databasnivå-constraints används för overlap-skydd på bokningar (en resurs kan inte dubbelbokas för samma tidsintervall), inte bara applikationslogik.

## Projektstruktur

```
innovia-hub4/
├── Innovia.Api/                 # Backend (.NET 10 minimal API)
│   ├── Common/                  # Delad infrastruktur (Auth, Database, Result, Errors, ...)
│   ├── Features/                # Vertical slices – en mapp per use-case (inkl. Assistant)
│   ├── Migrations/              # EF Core-migrations
│   └── Program.cs               # Composition root
├── frontend/                    # Frontend (React + Vite + TS)
│   └── src/
│       ├── api/                 # HTTP-klient mot backend
│       ├── auth/                # Auth-context/hooks
│       ├── components/          # Delade UI-komponenter
│       ├── hooks/                
│       ├── lib/                 # SignalR-anslutningar m.m.
│       └── pages/                # member/ och admin/ sidor
├── tests/
│   └── Innovia.Api.Tests/       # xUnit-tester (inkl. Testcontainers mot Postgres)
├── docker-compose.yaml          # Lokal utveckling (endast Postgres)
├── docker-compose.prod.yaml     # Produktion (api, frontend, postgres, caddy)
├── Caddyfile                    # Reverse proxy-konfiguration
└── .github/workflows/           # CI och deploy-pipelines
```

## Domänmodell

Kärnentiteterna (`Innovia.Api/Common/Database/Entities/`):

- **ApplicationUser / ApplicationRole** – användare och roller (bygger på ASP.NET Identity)
- **Resource** – en bokningsbar resurs (t.ex. ett rum eller en enhet), har en status (online/offline/underhåll)
- **ResourceType** – kategori av resurser, styr bl.a. bokningsregler
- **AvailabilityRule** – regler för när en resurstyp/resurs är bokningsbar
- **Booking** – en bokning kopplad till en användare och en resurs, med tidsintervall och status
- **RefreshToken** – roterande refresh-tokens kopplade till en användare

## Kom igång lokalt

Två sätt att köra lokalt: allt i Docker (`docker-compose.dev.yaml`, enklast) eller native (.NET/Node installerat lokalt, snabbare edit-loop för vissa). Kör inte båda samtidigt — de delar port `5432`/`5123`/`5173`.

### Alternativ A: allt i Docker

```bash
docker compose -f docker-compose.dev.yaml up
```

Startar Postgres, API (`dotnet watch run`, hot reload vid filändring) och frontend (Vite dev-server) i containrar, allt över vanlig HTTP på samma portar som nedan (`5123`/`5173`). Ingen `.env`-fil behövs — alla dev-värden ligger inlinead i `docker-compose.dev.yaml`.

Fördelen: både API och frontend körs konsekvent över HTTP på `localhost`, så auth-cookien fungerar med `SameSite=Strict` utan att behöva växla mellan HTTP/HTTPS-profiler manuellt — det är annars den vanligaste orsaken till att cookien "försvinner" i dev (schemeful same-site: en `https://localhost:7229`-cookie skickas inte med av en `http://localhost:5173`-request, trots att det är samma host).

Databasen ligger i en egen Docker-volym (`innovia_pgdata_dev`), separat från alternativ B nedan.

### Alternativ B: native

**Förutsättningar**

- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Node.js 22](https://nodejs.org/) + npm
- Docker (för PostgreSQL)

### 1. Starta databasen

```bash
docker compose up -d
```

Detta startar en lokal PostgreSQL-instans (`innovia_db`) på port `5432`, konfigurerad enligt `docker-compose.yaml`.

### AI-assistenten: API-nyckel

Assistenten behöver en OpenAI-nyckel. Lägg den i user-secrets, så ligger den utanför repot:

```bash
dotnet user-secrets init --project Innovia.Api
dotnet user-secrets set "OpenAi:ApiKey" "<din nyckel>" --project Innovia.Api
```

Varje utvecklare lägger in sin egen nyckel lokalt. Checka aldrig in nyckeln. Alternativ A (allt i Docker) läser inte user-secrets, så där måste nyckeln skickas in som miljövariabeln `OpenAi__ApiKey`.

Frontend läser `VITE_API_URL` från en `.env.development` i **repots rot** (Vite är konfigurerat med `envDir` som pekar dit):

```
VITE_API_URL=http://localhost:5123
```

### 2. Starta backend

```bash
cd Innovia.Api
dotnet run
```

Vid uppstart körs migrations och seed-data automatiskt mot databasen. API:et lyssnar som default på `http://localhost:5123` / `https://localhost:7229` (se `Properties/launchSettings.json`).

> Kör `dotnet run` utan `--launch-profile` (default `http`-profilen), eller uttryckligen `dotnet run --launch-profile http`, och håll frontend på `http://localhost:5173` (Vites default). Blandar man HTTP och HTTPS mellan frontend/backend räknas det som olika "sites" i webbläsaren (schemeful same-site), och då skickas inte auth-cookien med trots `SameSite=Strict` — inget att fixa i kod, bara hålla samma scheme på båda sidor. Se alternativ A ovan om du vill slippa tänka på det.

Standard-inloggning för adminkontot i utvecklingsläge sätts via `AdminUser`-konfigurationen i `appsettings.json` (byt ut i produktion via miljövariabler, se nedan).

### 3. Starta frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend startar via Vite (default `http://localhost:5173`) och pratar med backend via `VITE_API_URL` (se `.env`/`example.env`).

### 4. Öppna appen

Gå till frontend-adressen i webbläsaren, logga in med admin-kontot eller registrera en ny medlem.

## Miljövariabler

Se `example.env` för samtliga variabler som behövs för produktion/Docker Compose:

| Variabel | Beskrivning |
|---|---|
| `APP_DOMAIN` / `API_DOMAIN` | Domäner som Caddy terminerar TLS för och proxar vidare till frontend/api |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Databasuppgifter |
| `JWT_ISSUER` / `JWT_AUDIENCE` / `JWT_SECRET` | JWT-konfiguration (secret måste vara lång/slumpad i produktion) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Uppgifter för det seedade admin-kontot |
| `FRONTEND_ORIGIN` | Tillåten CORS-origin för API:et |
| `VITE_API_URL` | URL frontend bygger mot (bakas in i frontend-bygget) |
| `OpenAi__ApiKey` | API-nyckel för AI-assistenten (sätts som miljövariabel på servern, aldrig i filer i repot) |

Lokalt under utveckling styrs backend istället av `Innovia.Api/appsettings.json` / `appsettings.Development.json`.

## Tester

Backend-tester ligger i `tests/Innovia.Api.Tests` och använder xUnit, `Microsoft.AspNetCore.Mvc.Testing` (in-memory test-server) samt **Testcontainers** för att köra tester mot en riktig PostgreSQL-instans i container (inte in-memory-databas), vilket ger mer verklighetstrogna tester av bl.a. EF Core-queries och databas-constraints.

```bash
dotnet test tests/Innovia.Api.Tests/Innovia.Api.Tests.csproj
```

Kräver att Docker körs lokalt (för Testcontainers).

Frontend har lint via `oxlint`:

```bash
cd frontend
npm run lint
```

## CI/CD och deploy

**CI** (`.github/workflows/ci.yaml`) körs på push/PR mot `main` och `dev`:
- Backend: restore, build och `dotnet test` mot hela lösningen (`Innovia.slnx`)
- Frontend: `npm ci`, lint och build

**Deploy** (`.github/workflows/deploy.yaml`) körs på push till `main`:
1. Bygger och pushar Docker-images för API och frontend till GitHub Container Registry (GHCR), taggade med både `latest` och commit-SHA.
2. Kopierar `docker-compose.prod.yaml` och `Caddyfile` till produktionsservern via SCP.
3. SSH:ar in på servern, drar nya images (`IMAGE_TAG` = commit-SHA) och kör `docker compose up -d` för att rulla ut ny version, samt städar bort gamla images.

I produktion körs fyra containrar bakom varandra: **Caddy** (TLS-terminering + reverse proxy) → **frontend** (statisk build serverad av Caddy i sin egen container) och **api** (ASP.NET Core), samt **postgres** som delad databas. `api` och `postgres` ligger på ett internt Docker-nätverk som inte är exponerat utåt; endast Caddy publicerar portar (80/443).

## API-dokumentation (Scalar)

Projektet använder [Scalar](https://scalar.com/) för att visa och testa API:et interaktivt, baserat på OpenAPI-specen.

1. Starta API:t (`Innovia.Api`), t.ex. med `dotnet run` i mappen `Innovia.Api`.
2. Se till att du kör i Development-läge (`ASPNETCORE_ENVIRONMENT=Development`) — Scalar är bara aktiverat då.
3. Öppna webbläsaren på `/scalar/v1`, t.ex.:
   - `http://localhost:5123/scalar/v1`
   - `https://localhost:7229/scalar/v1`
4. I gränssnittet kan du bläddra bland alla endpoints, se request/response-scheman och skicka testanrop direkt.

## Säkerhet

Kort sammanfattning av de säkerhetsval som gjorts (se även koden i `Common/Auth/`):

- Access- och refresh-tokens lagras aldrig i `localStorage`/JS-läsbar cookie, utan endast som `HttpOnly`-cookies → skyddar mot att XSS kan stjäla tokens.
- Cookies sätts med `SameSite=Strict` + `Secure` i produktion → skyddar mot CSRF utan separata CSRF-tokens.
- Refresh tokens hashas i databasen och roteras vid varje refresh; återanvändning av en redan roterad/återkallad token triggar återkallning av hela tokenfamiljen.
- Inloggning går via `SignInManager` med kontolåsning (lockout) vid upprepade felförsök, inte bara ren lösenordskontroll.
- All auktorisering går via en global fallback-policy som kräver autentisering, med explicita roll-policys (`AdminOnly` m.fl.) där striktare krav behövs — inklusive på SignalR-hubbarna.
- Alla databasfrågor går via EF Core/LINQ (parametriserat), ingen rå SQL byggs av användarindata.
