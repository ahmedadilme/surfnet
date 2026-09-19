import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@oceantune.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "Ihsaan231460";
  const name = process.env.SEED_ADMIN_NAME || "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin user already exists — skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      name,
      role: "admin",
      passwordHash,
    },
  });

  console.log(`Admin user created: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
