import fs from "fs";
import path from "path";
import matter from "gray-matter";

const cardsDir = path.join(process.cwd(), "data/cards");
const outputFile = path.join(process.cwd(), "data/cards-data.json");

interface CardData {
  slug: string;
  title: string;
  type: "buff" | "debuff";
  icon: string;
  effect: string;
  tag?: string;
}

function generateCardsData() {
  const files = fs.readdirSync(cardsDir).filter((f) => f.endsWith(".mdx"));
  const cards: Record<string, CardData> = {};

  for (const file of files) {
    const filePath = path.join(cardsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    const slug = file.replace(/\.mdx$/, "");

    cards[slug] = {
      slug,
      title: data.title,
      type: data.type,
      icon: data.icon,
      effect: data.effect,
      tag: data.tag,
    };
  }

  fs.writeFileSync(outputFile, JSON.stringify(cards, null, 2));
  console.log(`Generated ${Object.keys(cards).length} cards to ${outputFile}`);
}

generateCardsData();
