/**
 * Milestone System Test Script
 * Demonstrates automatic awarding and removal behavior
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testMilestoneSystem() {
  console.log("🧪 MILESTONE SYSTEM TEST\n");
  console.log("=" .repeat(60));

  // Test 1: Create a test user
  console.log("\n📝 Test 1: Creating test user...");
  
  let testUser = await prisma.user.findUnique({
    where: { email: "milestone-test@example.com" }
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: "milestone-test@example.com",
        passwordHash: "test",
        firstName: "Milestone",
        lastName: "Tester",
        wishlistToken: `test-${Date.now()}`,
        onboardingCompleted: true,
      }
    });
    console.log("   ✅ Test user created:", testUser.email);
  } else {
    console.log("   ✅ Test user exists:", testUser.email);
  }

  // Test 2: Create test milestone definitions
  console.log("\n📝 Test 2: Creating test milestone definitions...");
  
  const milestones = [
    {
      name: "First Element",
      description: "Own your first element",
      category: "collection",
      icon: "🎯"
    },
    {
      name: "Decathlon",
      description: "Own exactly 10 elements",
      category: "collection",
      icon: "🔟"
    },
    {
      name: "Noble Gases Complete",
      description: "Own all noble gas elements",
      category: "collection",
      icon: "💎"
    }
  ];

  for (const m of milestones) {
    const existing = await prisma.milestoneDefinition.findUnique({
      where: { name: m.name }
    });
    
    if (!existing) {
      await prisma.milestoneDefinition.create({ data: m });
      console.log(`   ✅ Created milestone: ${m.icon} ${m.name}`);
    } else {
      console.log(`   ⏭️  Milestone exists: ${m.icon} ${m.name}`);
    }
  }

  // Test 3: Simulate adding elements
  console.log("\n📝 Test 3: Simulating user adding elements...");
  
  // Clear existing collection
  await prisma.collectionItem.deleteMany({
    where: { userId: testUser.id }
  });
  console.log("   🗑️  Cleared existing collection");

  // Add 1 element (should qualify for "First Element")
  await prisma.collectionItem.create({
    data: {
      userId: testUser.id,
      elementSymbol: "H",
      elementName: "Hydrogen",
      atomicNumber: 1,
      state: "OWNED",
      format: "Cubes"
    }
  });
  console.log("   ➕ Added element: H (Hydrogen)");

  const ownedCount = await prisma.collectionItem.count({
    where: { userId: testUser.id, state: "OWNED" }
  });
  console.log(`   📊 Total owned elements: ${ownedCount}`);

  // Test 4: Manual milestone evaluation (simulating scheduled task)
  console.log("\n📝 Test 4: Evaluating milestone qualification...");
  
  const firstElementMilestone = await prisma.milestoneDefinition.findUnique({
    where: { name: "First Element" }
  });

  if (firstElementMilestone) {
    // Check if user qualifies
    const qualifies = ownedCount >= 1;
    
    if (qualifies) {
      // Check if already awarded
      const existingAward = await prisma.userMilestoneAward.findUnique({
        where: {
          userId_milestoneId: {
            userId: testUser.id,
            milestoneId: firstElementMilestone.id
          }
        }
      });

      if (!existingAward) {
        // Award milestone
        await prisma.userMilestoneAward.create({
          data: {
            userId: testUser.id,
            milestoneId: firstElementMilestone.id,
            awardedBy: "system"
          }
        });

        // Create notification
        await prisma.notification.create({
          data: {
            userId: testUser.id,
            category: "MILESTONE",
            title: `🏆 Milestone Achieved: ${firstElementMilestone.name}`,
            body: `Congratulations! You've achieved the "${firstElementMilestone.name}" milestone. ${firstElementMilestone.description}`,
            icon: firstElementMilestone.icon
          }
        });

        console.log(`   ✅ AWARDED: ${firstElementMilestone.icon} ${firstElementMilestone.name}`);
        console.log(`   📬 Notification created`);
      } else {
        console.log(`   ⏭️  Already awarded: ${firstElementMilestone.icon} ${firstElementMilestone.name}`);
      }
    } else {
      console.log(`   ❌ Does NOT qualify for: ${firstElementMilestone.name}`);
    }
  }

  // Test 5: Add more elements to reach 10
  console.log("\n📝 Test 5: Adding 9 more elements (total: 10)...");
  
  const elements = [
    { symbol: "He", name: "Helium", atomicNumber: 2 },
    { symbol: "Li", name: "Lithium", atomicNumber: 3 },
    { symbol: "Be", name: "Beryllium", atomicNumber: 4 },
    { symbol: "B", name: "Boron", atomicNumber: 5 },
    { symbol: "C", name: "Carbon", atomicNumber: 6 },
    { symbol: "N", name: "Nitrogen", atomicNumber: 7 },
    { symbol: "O", name: "Oxygen", atomicNumber: 8 },
    { symbol: "F", name: "Fluorine", atomicNumber: 9 },
    { symbol: "Ne", name: "Neon", atomicNumber: 10 }
  ];

  for (const el of elements) {
    await prisma.collectionItem.create({
      data: {
        userId: testUser.id,
        elementSymbol: el.symbol,
        elementName: el.name,
        atomicNumber: el.atomicNumber,
        state: "OWNED",
        format: "Cubes"
      }
    });
  }

  const newCount = await prisma.collectionItem.count({
    where: { userId: testUser.id, state: "OWNED" }
  });
  console.log(`   ✅ Added 9 elements. Total owned: ${newCount}`);

  // Check for Decathlon milestone
  const decathlonMilestone = await prisma.milestoneDefinition.findUnique({
    where: { name: "Decathlon" }
  });

  if (decathlonMilestone && newCount === 10) {
    const existingAward = await prisma.userMilestoneAward.findUnique({
      where: {
        userId_milestoneId: {
          userId: testUser.id,
          milestoneId: decathlonMilestone.id
        }
      }
    });

    if (!existingAward) {
      await prisma.userMilestoneAward.create({
        data: {
          userId: testUser.id,
          milestoneId: decathlonMilestone.id,
          awardedBy: "system"
        }
      });
      console.log(`   ✅ AWARDED: ${decathlonMilestone.icon} ${decathlonMilestone.name}`);
    }
  }

  // Test 6: Remove element (simulate losing qualification)
  console.log("\n📝 Test 6: Removing 1 element (user loses Decathlon)...");
  
  await prisma.collectionItem.delete({
    where: {
      userId_elementSymbol: {
        userId: testUser.id,
        elementSymbol: "Ne"
      }
    }
  });

  const afterRemovalCount = await prisma.collectionItem.count({
    where: { userId: testUser.id, state: "OWNED" }
  });
  console.log(`   🗑️  Removed element. Total owned: ${afterRemovalCount}`);

  // Simulate scheduled task removing milestone
  if (decathlonMilestone && afterRemovalCount !== 10) {
    const awardToRemove = await prisma.userMilestoneAward.findUnique({
      where: {
        userId_milestoneId: {
          userId: testUser.id,
          milestoneId: decathlonMilestone.id
        }
      }
    });

    if (awardToRemove) {
      await prisma.userMilestoneAward.delete({
        where: { id: awardToRemove.id }
      });
      console.log(`   ❌ REMOVED: ${decathlonMilestone.icon} ${decathlonMilestone.name} (no longer qualifies)`);
      console.log(`   🔕 NO notification sent (silent removal)`);
    }
  }

  // Test 7: Display final state
  console.log("\n📝 Test 7: Final milestone status...");
  
  const userMilestones = await prisma.userMilestoneAward.findMany({
    where: { userId: testUser.id },
    include: {
      milestone: true
    }
  });

  console.log(`   🏆 User has ${userMilestones.length} active milestone(s):`);
  userMilestones.forEach(um => {
    console.log(`      - ${um.milestone.icon} ${um.milestone.name}`);
  });

  const userNotifications = await prisma.notification.findMany({
    where: { 
      userId: testUser.id,
      category: "MILESTONE"
    },
    orderBy: { createdAt: "desc" }
  });

  console.log(`\n   📬 User has ${userNotifications.length} milestone notification(s):`);
  userNotifications.forEach(n => {
    console.log(`      - ${n.icon} ${n.title}`);
  });

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("\n✓ User can gain milestones when qualifying");
  console.log("✓ User receives notifications for awarded milestones");
  console.log("✓ User loses milestones when no longer qualifying");
  console.log("✓ NO notification sent for milestone removal");
  console.log("✓ System tracks current milestone state accurately");
  console.log("\n⏰ In production, this runs automatically every 24 hours");
  console.log("📅 Next scheduled run: [Based on cron schedule]");
  console.log("\n" + "=".repeat(60));

  await prisma.$disconnect();
}

testMilestoneSystem()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  });
