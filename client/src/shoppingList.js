function parseGrams(amount) {
  const match = /^(\d+(\.\d+)?)\s*g$/i.exec((amount || "").trim());
  return match ? parseFloat(match[1]) : null;
}

const STOPWORDS = new Set([
  "a", "an", "the", "of", "for", "with", "to", "taste", "and", "or", "per", "in", "on",
  "your", "plus", "up", "more", "if", "needed", "optional", "eg", "ie", "approx", "approximately", "about",
]);

const QUANTITY_RE =
  /^(\d+\/\d+|\d+(\.\d+)?)(\s*[-–]\s*(\d+\/\d+|\d+(\.\d+)?))?\s*(g|kg|oz|lbs?|cups?|tbsp|tablespoons?|tsp|teaspoons?|ml|packets?|cans?|slices?|wedges?|cloves?|sticks?|pieces?|shots?|cartons?|bags?)?\b\s*/i;

function stripParens(text) {
  return text
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLabel(text) {
  return text.replace(/^[A-Za-z][A-Za-z /]{0,25}:\s*/, "").trim();
}

function stripQuantity(text) {
  return text.replace(QUANTITY_RE, "").trim();
}

function wordSetOf(name) {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9%\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOPWORDS.has(w) && !/^\d+(\.\d+)?$/.test(w))
  );
}

function isSubsetWithin(small, large, maxExtra) {
  for (const w of small) {
    if (!large.has(w)) return false;
  }
  return large.size - small.size <= maxExtra;
}

function sameIngredient(a, b) {
  if (a.size === 0 || b.size === 0) return false;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  return isSubsetWithin(small, large, small.size === large.size ? 0 : 2);
}

function segmentsFromIngredientLine(line) {
  const noLabel = stripLabel(stripParens(line));
  return noLabel
    .split(/\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

export function buildShoppingList(days, recipes = []) {
  const recipeByName = new Map(recipes.map((r) => [r.name.trim().toLowerCase(), r]));
  const recipeUsage = new Map();
  const otherGroups = new Map();

  for (const day of days) {
    for (const item of day.items) {
      const key = item.name.trim().toLowerCase();
      const recipe = recipeByName.get(key);

      if (recipe && recipe.ingredients?.length > 0) {
        if (!recipeUsage.has(key)) {
          recipeUsage.set(key, { name: recipe.name, count: 0, ingredients: recipe.ingredients });
        }
        recipeUsage.get(key).count += 1;
        continue;
      }

      if (!otherGroups.has(key)) {
        otherGroups.set(key, { name: item.name, gramsTotal: 0, hasGrams: false, otherAmounts: [] });
      }
      const g = otherGroups.get(key);
      const grams = parseGrams(item.amount);
      if (grams != null) {
        g.gramsTotal += grams;
        g.hasGrams = true;
      } else if (item.amount) {
        g.otherAmounts.push(item.amount);
      }
    }
  }

  const mentions = [];
  for (const usage of recipeUsage.values()) {
    for (const line of usage.ingredients) {
      for (const seg of segmentsFromIngredientLine(line)) {
        const name = stripQuantity(seg);
        const wordSet = wordSetOf(name);
        if (wordSet.size === 0) continue;
        mentions.push({ recipeName: usage.name, recipeCount: usage.count, display: seg, name, wordSet });
      }
    }
  }

  const uf = new UnionFind(mentions.length);
  for (let i = 0; i < mentions.length; i++) {
    for (let j = i + 1; j < mentions.length; j++) {
      if (sameIngredient(mentions[i].wordSet, mentions[j].wordSet)) {
        uf.union(i, j);
      }
    }
  }

  const clusters = new Map();
  mentions.forEach((m, i) => {
    const root = uf.find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(m);
  });

  const ingredientGroups = Array.from(clusters.values()).map((group) => {
    const canonical = group.reduce((best, m) => (m.wordSet.size > best.wordSet.size ? m : best));
    const name = canonical.name.replace(/^./, (c) => c.toUpperCase());

    const seen = new Set();
    const sources = [];
    for (const m of group) {
      const sourceKey = `${m.recipeName}::${m.display}`;
      if (seen.has(sourceKey)) continue;
      seen.add(sourceKey);
      sources.push({ recipeName: m.recipeName, recipeCount: m.recipeCount, display: m.display });
    }
    sources.sort((a, b) => a.recipeName.localeCompare(b.recipeName));

    return { name, sources };
  });

  ingredientGroups.sort((a, b) => a.name.localeCompare(b.name));

  const otherList = Array.from(otherGroups.values())
    .map((g) => {
      const parts = [];
      if (g.hasGrams) parts.push(`${Math.round(g.gramsTotal)}g`);
      parts.push(...g.otherAmounts);
      return { name: g.name, amount: parts.join(" + ") };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { ingredients: ingredientGroups, other: otherList };
}
