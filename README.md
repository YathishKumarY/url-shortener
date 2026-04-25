# Linkly - URL Shortener

A full-stack URL shortener with analytics, built with Next.js 16.

## Features

- **URL Shortening** - Generate short links with custom aliases or auto-generated codes
- **QR Codes** - Generate downloadable QR codes for any shortened link
- **Analytics Dashboard** - Track clicks, referrers, browsers, devices, and locations
- **Real-time Click Stream** - Live click event streaming via Server-Sent Events
- **Authentication** - Email/password, Google, and GitHub OAuth via NextAuth v5
- **Rate Limiting** - API protection with Upstash Redis
- **Dark/Light Mode** - Theme toggle with `next-themes`
- **Link Expiration** - Optional expiry dates for shortened links

## Tech Stack

- **Framework** - [Next.js 16](https://nextjs.org/) (App Router)
- **Database** - PostgreSQL via [Neon](https://neon.tech/) serverless
- **ORM** - [Prisma 7](https://www.prisma.io/)
- **Auth** - [NextAuth v5](https://authjs.dev/)
- **Rate Limiting** - [Upstash Redis](https://upstash.com/)
- **UI** - [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Recharts](https://recharts.org/)
- **Validation** - [Zod](https://zod.dev/)
- **Testing** - [Vitest](https://vitest.dev/)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (e.g. [Neon](https://neon.tech/))
- [Upstash Redis](https://upstash.com/) instance

### Setup

1. Clone the repo:

   ```bash
   git clone https://github.com/YathishKumarY/url-shortener.git
   cd url-shortener
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment file and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   ```
   DATABASE_URL=           # Neon PostgreSQL connection string
   AUTH_SECRET=             # Generate with: npx auth secret
   AUTH_GOOGLE_ID=          # Google OAuth client ID
   AUTH_GOOGLE_SECRET=      # Google OAuth client secret
   AUTH_GITHUB_ID=          # GitHub OAuth client ID
   AUTH_GITHUB_SECRET=      # GitHub OAuth client secret
   UPSTASH_REDIS_REST_URL=  # Upstash Redis REST URL
   UPSTASH_REDIS_REST_TOKEN= # Upstash Redis REST token
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Push the database schema:

   ```bash
   npx prisma db push
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

## Scripts

| Command             | Description               |
| ------------------- | ------------------------- |
| `npm run dev`       | Start development server  |
| `npm run build`     | Build for production      |
| `npm run start`     | Start production server   |
| `npm run lint`      | Run ESLint                |
| `npm run format`    | Format code with Prettier |
| `npm run test`      | Run tests                 |
| `npm run db:push`   | Push Prisma schema to DB  |
| `npm run db:studio` | Open Prisma Studio        |

## Deployment

This app is designed to deploy on [Vercel](https://vercel.com/). Set the environment variables in your Vercel project settings and deploy.

## License

MIT
