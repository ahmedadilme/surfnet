import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const round = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const recharges = await prisma.recharge.findMany({ where: { paid: true, amountPaid: 0 } });
  for (const r of recharges) {
    await prisma.recharge.update({ where: { id: r.id }, data: { amountPaid: r.amount, paid: true } });
  }
  console.log(`Recharges backfilled: ${recharges.length}`);

  const invoices = await prisma.invoice.findMany({ where: { paid: true, amountPaid: 0 }, include: { items: true } });
  for (const inv of invoices) {
    const total = round(inv.items.reduce((s, i) => s + i.amount, 0));
    await prisma.invoice.update({ where: { id: inv.id }, data: { amountPaid: total, paid: true } });
  }
  console.log(`Invoices backfilled: ${invoices.length}`);

  const partialInvoices = await prisma.invoice.findMany({ where: { paid: false, amountPaid: { gt: 0 } }, include: { items: true } });
  let flippedInvoices = 0;
  for (const inv of partialInvoices) {
    const total = round(inv.items.reduce((s, i) => s + i.amount, 0));
    if (round(inv.amountPaid) >= total) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { paid: true } });
      flippedInvoices++;
    }
  }
  console.log(`Invoices flipped to paid: ${flippedInvoices}`);

  const partialRecharges = await prisma.recharge.findMany({ where: { paid: false, amountPaid: { gt: 0 } } });
  let flippedRecharges = 0;
  for (const r of partialRecharges) {
    if (round(r.amountPaid) >= round(r.amount)) {
      await prisma.recharge.update({ where: { id: r.id }, data: { paid: true } });
      flippedRecharges++;
    }
  }
  console.log(`Recharges flipped to paid: ${flippedRecharges}`);

  console.log("Backfill complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());