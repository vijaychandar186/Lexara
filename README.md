# Lexara

Lexara is a web app built with **Next.js**, **TypeScript**, **Supabase**, and the **Mistral AI OCR API** to convert PDFs into Markdown via OCR. It supports both synchronous and asynchronous processing, with quotas managed via **Razorpay**.

## Features

* PDF upload with drag-and-drop & validation (type, size, page count)
* OCR to Markdown using Mistral AI OCR API
* Sync processing for small PDFs (<5MB or <10 pages)
* Async processing for larger PDFs with status polling
* Quota management by subscription tier (Free, Pro, Premium)
* Supabase storage for file outputs
* OAuth via Google and GitHub (NextAuth)
* Razorpay for payments and plan management

## Tech Stack

* **Frontend**: Next.js, TypeScript, Shadcn UI, Dropzone, Sonner
* **Backend**: Next.js Server Actions, Prisma, Neon (PostgreSQL)
* **Storage**: Supabase Storage
* **OCR**: Mistral AI OCR API
* **Auth**: NextAuth (Google, GitHub)
* **Payments**: Razorpay

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/vijaychandar186/nextjs-ocr-saas
cd nextjs-ocr-saas
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Get API keys

#### NextAuth secret
Generate a random secret:
```bash
openssl rand -base64 32
```

#### GitHub OAuth
1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Set **Homepage URL** and **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`
3. Copy **Client ID** and **Client Secret**

#### Google OAuth
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → Create project
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI
4. Copy **Client ID** and **Client Secret**

#### Neon (Database)
1. Go to [neon.tech](https://neon.tech) → Create project
2. Copy the **connection string** from the dashboard

#### Supabase (File Storage)
1. Go to [supabase.com](https://supabase.com) → Create project
2. Settings → API → copy **Project URL** and **service_role** secret key
3. Storage → Create bucket named `files`, set to **public**
4. Edit bucket → Allowed MIME types → add `application/pdf` and `text/markdown`

#### Mistral AI
1. Go to [console.mistral.ai](https://console.mistral.ai) → API Keys → Create key
2. Copy the key

#### Razorpay
1. Go to [razorpay.com](https://razorpay.com) → Dashboard → Settings → API Keys → Generate
2. Copy **Key ID** and **Key Secret**
3. Dashboard → Subscriptions → Plans → create Pro and Premium plans → copy plan IDs

### 4. Create `.env`

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generated-secret>
AUTH_TRUST_HOST=http://localhost:3000

# OAuth
AUTH_GOOGLE_ID=<google-client-id>
AUTH_GOOGLE_SECRET=<google-client-secret>
AUTH_GITHUB_ID=<github-client-id>
AUTH_GITHUB_SECRET=<github-client-secret>

# Neon (Database)
DATABASE_URL=<neon-connection-string>

# Supabase (File Storage)
SUPABASE_URL=<project-url>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Mistral OCR
MISTRAL_API_KEY=<mistral-api-key>

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=<razorpay-key-id>
RAZORPAY_KEY_ID=<razorpay-key-id>
RAZORPAY_KEY_SECRET=<razorpay-key-secret>
RAZORPAY_PRO_PLAN_ID=<pro-plan-id>
RAZORPAY_PREMIUM_PLAN_ID=<premium-plan-id>
```

### 5. Set up database

```bash
pnpm db:push
```

### 6. Run dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)
