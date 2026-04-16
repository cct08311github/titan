import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  // Prisma 7+ reads seed from here, not package.json "prisma.seed"
  seed: 'npx tsx prisma/seed.ts',
})
