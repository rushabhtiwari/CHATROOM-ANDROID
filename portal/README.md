# Portal

The company app launcher and admin console. People sign in once through the identity service,
see a card for every app they can open, and open each already signed in. Admins manage people,
departments, apps and exceptions, and can read the activity log.

Designs:

- `docs/superpowers/specs/2026-09-16-central-platform-sso-design.md` (§7): sign-in and admin console
- `docs/superpowers/specs/2026-09-17-app-catalog-and-launcher-design.md`: app catalog, statuses, logos
- `docs/superpowers/specs/2026-09-17-workspace-redesign-design.md`: visual system and page layouts

## Run it locally

Requires Node.js 24 and the identity service from the repository root:

```bash
docker compose up -d            # identity service on http://localhost:8000, dev login enabled
cd portal
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

Sign in with any seeded user on the development login page. `admin@yourco.com` is an admin.

## Checks

```bash
npm test                 # unit and component tests (Vitest)
npm run lint
npm run typecheck
npm run format:check
npm run test:e2e         # builds the portal and drives it against the running identity service
```

The end-to-end tests need `docker compose up -d` first. They create departments and apps with
unique names in the development database.

## Where things are

| Path                                  | What it holds                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `app/page.tsx`, `components/Home.tsx` | Home page: summary cards, filters and app cards (logic in `lib/home.ts`)                               |
| `app/admin/*`                         | Admin pages: People, Departments, Apps, Activity log, each with its server actions                     |
| `app/globals.css`                     | The whole design system: tokens on `:root`, then one section per area                                  |
| `components/ui/*`                     | Shared building blocks: `PageHeader`, `Card`, `Badge`, `StatCard`, `Segmented`, `Switch`, `Disclosure` |
| `components/TopBar.tsx`               | Top navigation, global search (`/` or Ctrl/⌘+K) and account menu                                       |
| `components/AppMark.tsx`              | App icon tile: uploaded logo, or a Phosphor duotone icon on a gradient (`lib/tones.ts`)                |
| `lib/icons.tsx`                       | Maps the stored icon names to Phosphor icons                                                           |

Icons come from [Phosphor](https://phosphoricons.com). Import components from
`@phosphor-icons/react/ssr` so they render in server components; the `Icon` type comes from
`@phosphor-icons/react`. To offer a new app icon, add its stored name and Phosphor component to
`lib/icons.tsx`; the identity service accepts any lowercase name, so no migration is needed.

## Configuration

| Variable             | Purpose                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `AUTH_SECRET`        | Encrypts the session cookie. Generate with `npx auth secret`.               |
| `AUTH_URL`           | Public URL of the portal, e.g. `https://portal.yourco.com`                  |
| `AUTH_ISSUER`        | Identity service URL as browsers see it; must equal its `ISSUER_URL`        |
| `AUTH_CLIENT_SECRET` | Must equal the identity service's `PORTAL_CLIENT_SECRET`                    |
| `IDENTITY_API_URL`   | Identity service URL as this server reaches it (can be an internal address) |

## How sign-in works here

- `proxy.ts` runs Auth.js on every page request. Signed-out visitors go to `/signin`, which starts
  the OpenID Connect flow with the identity service.
- Tokens live only in the encrypted, HttpOnly session cookie. Server code reads the access token
  with `getAccessToken()` (`lib/session.ts`) and calls the identity API through `lib/identity.ts`.
- Access tokens last 15 minutes. The proxy renews them a minute before expiry and saves the new
  cookie. If renewal fails, the person is sent to sign in again.
- Sign out ends the portal session and the identity session, which signs the person out of every
  app within 15 minutes.

## Deploying

```bash
docker build -t portal .
docker run -p 3000:3000 --env-file portal.env portal
```

The image runs Next.js's standalone server as the unprivileged `node` user.
