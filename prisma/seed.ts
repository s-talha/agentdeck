import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEMO_EMAIL = "demo@agentdeck.dev";
const DEMO_PASSWORD = "agentdeck-demo";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_EMAIL, name: "Demo User", passwordHash },
  });

  await db.agent.deleteMany({ where: { userId: user.id } });

  await db.agent.createMany({
    data: [
      {
        userId: user.id,
        name: "Research assistant",
        description: "Looks up topics on Wikipedia and answers with sources.",
        systemPrompt:
          "You are a careful research assistant. Use the Wikipedia tool to check facts before answering. Keep answers under 120 words and name the article you used.",
        tools: ["wikipedia_summary", "current_time"],
        maxSteps: 6,
      },
      {
        userId: user.id,
        name: "Quote calculator",
        description: "Works out project quotes from hours, rates and VAT.",
        systemPrompt:
          "You help a freelancer price work. Always use the calculator for arithmetic, show the formula you used, and give the final amount on its own line.",
        tools: ["calculator"],
        maxSteps: 4,
      },
    ],
  });

  console.log(`Seeded ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
