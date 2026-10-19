import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { crearPoolPg } from '../../src/lib/pool-pg'
import { seedRubrosBase } from './rubros'

const adapter = new PrismaPg(crearPoolPg({ connectionString: process.env.DATABASE_URL! }), {
  disposeExternalPool: true,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Starting seed...')
  await seedRubrosBase(prisma)
  console.log('Seed completed.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
