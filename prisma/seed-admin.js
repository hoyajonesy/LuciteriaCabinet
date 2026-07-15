/**
 * Admin Backend MVP — Seed Script
 * Creates admin users, formats, milestones, collection sets, and mock users.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const MOTIVATIONS = ["INVENTORY", "SOCIAL", "ACQUISITION", "INVESTMENT", "DISCOVERY"];
const TIERS = ["Free", "Collector", "Curator"];

// Elements for seed data
const ELEMENTS_SAMPLE = [
  { z: 1, sym: "H" }, { z: 2, sym: "He" }, { z: 3, sym: "Li" }, { z: 4, sym: "Be" },
  { z: 5, sym: "B" }, { z: 6, sym: "C" }, { z: 7, sym: "N" }, { z: 8, sym: "O" },
  { z: 9, sym: "F" }, { z: 10, sym: "Ne" }, { z: 11, sym: "Na" }, { z: 12, sym: "Mg" },
  { z: 13, sym: "Al" }, { z: 14, sym: "Si" }, { z: 15, sym: "P" }, { z: 16, sym: "S" },
  { z: 17, sym: "Cl" }, { z: 18, sym: "Ar" }, { z: 26, sym: "Fe" }, { z: 29, sym: "Cu" },
  { z: 30, sym: "Zn" }, { z: 47, sym: "Ag" }, { z: 48, sym: "Cd" }, { z: 50, sym: "Sn" },
  { z: 74, sym: "W" }, { z: 78, sym: "Pt" }, { z: 79, sym: "Au" }, { z: 82, sym: "Pb" },
  { z: 36, sym: "Kr" }, { z: 54, sym: "Xe" },
];

const ELEMENT_NAMES = {
  H: "Hydrogen", He: "Helium", Li: "Lithium", Be: "Beryllium", B: "Boron",
  C: "Carbon", N: "Nitrogen", O: "Oxygen", F: "Fluorine", Ne: "Neon",
  Na: "Sodium", Mg: "Magnesium", Al: "Aluminum", Si: "Silicon", P: "Phosphorus",
  S: "Sulfur", Cl: "Chlorine", Ar: "Argon", Fe: "Iron", Cu: "Copper",
  Zn: "Zinc", Ag: "Silver", Cd: "Cadmium", Sn: "Tin", W: "Tungsten",
  Pt: "Platinum", Au: "Gold", Pb: "Lead", Kr: "Krypton", Xe: "Xenon",
};

const FORMATS = ["lucite", "10mm", "ampoules", "Other"];

const MOCK_USERS = [
  { first: "Chris", last: "Johnson", motiv: "INVESTMENT", tier: "Curator", ownCount: 52 },
  { first: "Sarah", last: "Chen", motiv: "ACQUISITION", tier: "Collector", ownCount: 38 },
  { first: "Michael", last: "Williams", motiv: "INVENTORY", tier: "Free", ownCount: 15 },
  { first: "Emily", last: "Davis", motiv: "DISCOVERY", tier: "Collector", ownCount: 27 },
  { first: "James", last: "Brown", motiv: "SOCIAL", tier: "Free", ownCount: 8 },
  { first: "Jessica", last: "Martinez", motiv: "INVESTMENT", tier: "Curator", ownCount: 45 },
  { first: "David", last: "Anderson", motiv: "ACQUISITION", tier: "Collector", ownCount: 33 },
  { first: "Ashley", last: "Taylor", motiv: "DISCOVERY", tier: "Free", ownCount: 12 },
  { first: "Robert", last: "Thomas", motiv: "INVENTORY", tier: "Free", ownCount: 6 },
  { first: "Amanda", last: "Jackson", motiv: "SOCIAL", tier: "Collector", ownCount: 22 },
  { first: "Daniel", last: "White", motiv: "INVESTMENT", tier: "Curator", ownCount: 61 },
  { first: "Lauren", last: "Harris", motiv: "ACQUISITION", tier: "Free", ownCount: 18 },
  { first: "Matthew", last: "Clark", motiv: "DISCOVERY", tier: "Collector", ownCount: 29 },
  { first: "Stephanie", last: "Lewis", motiv: "INVENTORY", tier: "Free", ownCount: 4 },
  { first: "Andrew", last: "Robinson", motiv: "SOCIAL", tier: "Free", ownCount: 9 },
  { first: "Jennifer", last: "Walker", motiv: "INVESTMENT", tier: "Collector", ownCount: 35 },
  { first: "Joshua", last: "Hall", motiv: "ACQUISITION", tier: "Free", ownCount: 14 },
  { first: "Nicole", last: "Allen", motiv: "DISCOVERY", tier: "Curator", ownCount: 48 },
  { first: "Ryan", last: "Young", motiv: "INVENTORY", tier: "Free", ownCount: 7 },
  { first: "Megan", last: "King", motiv: "SOCIAL", tier: "Collector", ownCount: 25 },
  { first: "Brian", last: "Wright", motiv: "INVESTMENT", tier: "Free", ownCount: 11 },
  { first: "Rachel", last: "Lopez", motiv: "ACQUISITION", tier: "Free", ownCount: 16 },
  { first: "Kevin", last: "Hill", motiv: "DISCOVERY", tier: "Collector", ownCount: 31 },
  { first: "Samantha", last: "Scott", motiv: "INVENTORY", tier: "Free", ownCount: 3 },
  { first: "Patrick", last: "Green", motiv: "SOCIAL", tier: "Free", ownCount: 10 },
  { first: "Olivia", last: "Adams", motiv: "INVESTMENT", tier: "Curator", ownCount: 55 },
  { first: "Marcus", last: "Baker", motiv: "ACQUISITION", tier: "Collector", ownCount: 40 },
  { first: "Hannah", last: "Nelson", motiv: "DISCOVERY", tier: "Free", ownCount: 19 },
  { first: "Tyler", last: "Carter", motiv: "INVENTORY", tier: "Free", ownCount: 5 },
  { first: "Grace", last: "Mitchell", motiv: "SOCIAL", tier: "Collector", ownCount: 23 },
];

async function main() {
  console.log("🌱 Seeding Admin Backend MVP data...\n");

  // ─── 1. Admin Users ───
  console.log("👤 Creating admin users...");
  const adminPass = await bcrypt.hash("admin123", 10);

  const admins = [
    { name: "Admin User", email: "admin@luciteria.com" },
    { name: "Chris Merola", email: "chris@luciteria.com" },
  ];

  for (const a of admins) {
    await prisma.adminUser.upsert({
      where: { email: a.email },
      update: {},
      create: { ...a, passwordHash: adminPass },
    });
  }
  console.log(`   ✅ ${admins.length} admin users created (password: admin123)\n`);

  // ─── 2. Formats ───
  console.log("📐 Creating formats...");
  const formatDefs = [
    { name: "Lucite Cube", description: "50mm acrylic display cube with embedded element sample", displayOrder: 1 },
    { name: "10mm Cube", description: "Small 10mm metal cube for compact collections", displayOrder: 2 },
    { name: "1 inch Cube", description: "25.4mm (1 inch) metal cube, mid-size display", displayOrder: 3 },
    { name: "Ampoule", description: "Sealed glass ampoule containing element sample", displayOrder: 4 },
    { name: "Foil", description: "Thin foil specimen for flat element samples", displayOrder: 5 },
    { name: "Wire", description: "Wire-form element specimen", displayOrder: 6 },
    { name: "Crystal", description: "Crystalline form element specimen", displayOrder: 7 },
    { name: "Coin/Disc", description: "Coin or disc-shaped element specimen", displayOrder: 8 },
    { name: "Other", description: "Other format not listed above", displayOrder: 9 },
  ];

  for (const f of formatDefs) {
    await prisma.format.upsert({
      where: { name: f.name },
      update: { description: f.description, displayOrder: f.displayOrder },
      create: f,
    });
  }
  console.log(`   ✅ ${formatDefs.length} formats created\n`);

  // ─── 3. Milestone Definitions ───
  console.log("🏆 Creating milestone definitions...");
  const milestoneDefs = [
    { name: "Noble Gases Complete", description: "Collected all noble gas elements (He, Ne, Ar, Kr, Xe, Rn)", category: "collection", icon: "💎" },
    { name: "Alkali Metals Complete", description: "Collected all alkali metal elements", category: "collection", icon: "🔥" },
    { name: "Transition Metals Complete", description: "Collected all transition metal elements", category: "collection", icon: "⚙️" },
    { name: "Full Lucite Format Set", description: "Owns every available element in Lucite format", category: "format", icon: "🧊" },
    { name: "Full 10mm Cube Set", description: "Owns every available element in 10mm cube format", category: "format", icon: "📦" },
    { name: "First Element", description: "Added their first element to the collection", category: "engagement", icon: "🌟" },
    { name: "10 Elements Milestone", description: "Collection reached 10 elements", category: "engagement", icon: "🔟" },
    { name: "25 Elements Milestone", description: "Collection reached 25 elements", category: "engagement", icon: "🎯" },
    { name: "50 Elements Milestone", description: "Collection reached 50 elements — halfway there!", category: "engagement", icon: "🏅" },
    { name: "100 Elements Milestone", description: "Collection reached 100 elements — nearly complete!", category: "engagement", icon: "💯" },
    { name: "Completionist", description: "Collected all 118 elements — the ultimate achievement!", category: "engagement", icon: "👑" },
    { name: "Lanthanides Complete", description: "Collected all lanthanide elements", category: "collection", icon: "🌈" },
    { name: "Actinides Complete", description: "Collected all actinide elements", category: "collection", icon: "☢️" },
  ];

  for (const m of milestoneDefs) {
    await prisma.milestoneDefinition.upsert({
      where: { name: m.name },
      update: { description: m.description, category: m.category, icon: m.icon },
      create: m,
    });
  }
  console.log(`   ✅ ${milestoneDefs.length} milestone definitions created\n`);

  // ─── 4. Collection Sets ───
  console.log("📦 Creating collection sets...");
  const setDefs = [
    {
      name: "Noble Gases Starter Pack",
      description: "The six noble gases — perfect for beginning your collection with the most stable elements.",
      tier: "Free", setType: "Starter",
      elements: [
        { sym: "He", z: 2 }, { sym: "Ne", z: 10 }, { sym: "Ar", z: 18 },
        { sym: "Kr", z: 36 }, { sym: "Xe", z: 54 }, { sym: "Rn", z: 86 },
      ],
    },
    {
      name: "Precious Metals Collection",
      description: "The classic precious metals — gold, silver, platinum and more.",
      tier: "Collector", setType: "Complete",
      elements: [
        { sym: "Ag", z: 47 }, { sym: "Au", z: 79 }, { sym: "Pt", z: 78 },
        { sym: "Pd", z: 46 }, { sym: "Rh", z: 45 }, { sym: "Ir", z: 77 },
        { sym: "Os", z: 76 }, { sym: "Ru", z: 44 },
      ],
    },
    {
      name: "Everyday Elements",
      description: "Elements you encounter in daily life — iron, copper, aluminum and more.",
      tier: "Free", setType: "Starter",
      elements: [
        { sym: "Fe", z: 26 }, { sym: "Cu", z: 29 }, { sym: "Al", z: 13 },
        { sym: "Si", z: 14 }, { sym: "C", z: 6 }, { sym: "Sn", z: 50 },
        { sym: "Zn", z: 30 }, { sym: "Pb", z: 82 }, { sym: "Ni", z: 28 },
      ],
    },
    {
      name: "Alkali Metals Set",
      description: "The reactive alkali metals group — handle with care!",
      tier: "Collector", setType: "Complete",
      elements: [
        { sym: "Li", z: 3 }, { sym: "Na", z: 11 }, { sym: "K", z: 19 },
        { sym: "Rb", z: 37 }, { sym: "Cs", z: 55 }, { sym: "Fr", z: 87 },
      ],
    },
    {
      name: "Curator's Challenge — Rare Earths",
      description: "The complete rare earth elements collection — a true curator's achievement.",
      tier: "Curator", setType: "Complete",
      elements: [
        { sym: "La", z: 57 }, { sym: "Ce", z: 58 }, { sym: "Pr", z: 59 },
        { sym: "Nd", z: 60 }, { sym: "Pm", z: 61 }, { sym: "Sm", z: 62 },
        { sym: "Eu", z: 63 }, { sym: "Gd", z: 64 }, { sym: "Tb", z: 65 },
        { sym: "Dy", z: 66 }, { sym: "Ho", z: 67 }, { sym: "Er", z: 68 },
        { sym: "Tm", z: 69 }, { sym: "Yb", z: 70 }, { sym: "Lu", z: 71 },
      ],
    },
  ];

  for (const s of setDefs) {
    const existing = await prisma.collectionSet.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.collectionSet.create({
        data: {
          name: s.name,
          description: s.description,
          tier: s.tier,
          setType: s.setType,
          elements: {
            create: s.elements.map(e => ({
              elementSymbol: e.sym,
              atomicNumber: e.z,
            })),
          },
        },
      });
    }
  }
  console.log(`   ✅ ${setDefs.length} collection sets created\n`);

  // ─── 5. Mock Users with Collection Data ───
  console.log("👥 Creating mock users with collections...");
  const userPass = await bcrypt.hash("password123", 10);
  let createdUsers = 0;
  let frozenCount = 0;

  for (let i = 0; i < MOCK_USERS.length; i++) {
    const mu = MOCK_USERS[i];
    const email = `${mu.first.toLowerCase()}.${mu.last.toLowerCase()}@example.com`;
    const isFrozen = i === 8; // Freeze one user for testing

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) continue;

    // Randomly shift createdAt to spread across last 90 days
    const daysAgo = Math.floor(Math.random() * 90);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: userPass,
        firstName: mu.first,
        lastName: mu.last,
        wishlistToken: uuidv4(),
        onboardingCompleted: true,
        onboardingStep: 5,
        primaryMotivation: mu.motiv,
        tier: mu.tier,
        status: isFrozen ? "frozen" : "active",
        freezeReason: isFrozen ? "Suspicious account activity — under review" : null,
        createdAt,
      },
    });

    if (isFrozen) {
      frozenCount++;
      await prisma.freezeLog.create({
        data: {
          userId: user.id,
          reason: "Suspicious account activity — under review",
          frozenBy: "admin@luciteria.com",
        },
      });
    }

    // Create collection items (owned)
    const shuffled = [...ELEMENTS_SAMPLE].sort(() => Math.random() - 0.5);
    const ownedElements = shuffled.slice(0, Math.min(mu.ownCount, shuffled.length));
    const format = FORMATS[Math.floor(Math.random() * FORMATS.length)];

    for (const el of ownedElements) {
      await prisma.collectionItem.create({
        data: {
          userId: user.id,
          elementSymbol: el.sym,
          elementName: ELEMENT_NAMES[el.sym] || el.sym,
          atomicNumber: el.z,
          state: "OWNED",
          format,
        },
      });
    }

    // Add some wanted elements
    const remaining = shuffled.slice(mu.ownCount, mu.ownCount + 5);
    for (const el of remaining) {
      try {
        await prisma.collectionItem.create({
          data: {
            userId: user.id,
            elementSymbol: el.sym,
            elementName: ELEMENT_NAMES[el.sym] || el.sym,
            atomicNumber: el.z,
            state: "WANTED",
            priority: Math.floor(Math.random() * 3) + 1,
          },
        });
      } catch (e) {
        // Skip duplicates
      }
    }

    createdUsers++;
  }
  console.log(`   ✅ ${createdUsers} mock users created (${frozenCount} frozen)\n`);

  // ─── 6. Award some milestones ───
  console.log("🎖️ Awarding sample milestones...");
  const firstMilestone = await prisma.milestoneDefinition.findFirst({ where: { name: "First Element" } });
  const tenMilestone = await prisma.milestoneDefinition.findFirst({ where: { name: "10 Elements Milestone" } });
  const allUsers = await prisma.user.findMany({ take: 10, select: { id: true } });

  if (firstMilestone) {
    for (const u of allUsers.slice(0, 8)) {
      try {
        await prisma.userMilestoneAward.create({
          data: { userId: u.id, milestoneId: firstMilestone.id, awardedBy: "admin@luciteria.com" },
        });
      } catch (e) { /* skip dups */ }
    }
  }
  if (tenMilestone) {
    for (const u of allUsers.slice(0, 5)) {
      try {
        await prisma.userMilestoneAward.create({
          data: { userId: u.id, milestoneId: tenMilestone.id, awardedBy: "admin@luciteria.com" },
        });
      } catch (e) { /* skip dups */ }
    }
  }
  console.log("   ✅ Sample milestones awarded\n");

  // ─── Summary ───
  const counts = {
    admins: await prisma.adminUser.count(),
    formats: await prisma.format.count(),
    milestones: await prisma.milestoneDefinition.count(),
    sets: await prisma.collectionSet.count(),
    users: await prisma.user.count(),
    collections: await prisma.collectionItem.count(),
    awards: await prisma.userMilestoneAward.count(),
  };

  console.log("═══════════════════════════════════════");
  console.log("  Admin Backend MVP — Seed Summary");
  console.log("═══════════════════════════════════════");
  console.log(`  Admin Users:     ${counts.admins}`);
  console.log(`  Formats:         ${counts.formats}`);
  console.log(`  Milestones:      ${counts.milestones}`);
  console.log(`  Collection Sets: ${counts.sets}`);
  console.log(`  Total Users:     ${counts.users}`);
  console.log(`  Collection Items:${counts.collections}`);
  console.log(`  Awards Given:    ${counts.awards}`);
  console.log("═══════════════════════════════════════");
  console.log("\n🔑 Admin Login Credentials:");
  console.log("   Email: admin@luciteria.com");
  console.log("   Password: admin123\n");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
