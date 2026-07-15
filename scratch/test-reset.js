import { generateUserResetToken, verifyUserResetToken, resetUserPasswordWithToken, verifyLogin, createUser } from '../app/lib/auth.server.js';
import { prisma } from '../app/lib/db.server.js';

async function runTest() {
  console.log("=== STARTING PASSWORD RESET FLOW TEST ===");
  const testEmail = "reset-test-user@example.com";
  
  // 1. Clean up existing test user
  await prisma.user.delete({ where: { email: testEmail } }).catch(() => {});
  
  // 2. Create a test user
  console.log("Creating test user...");
  const signupResult = await createUser({
    email: testEmail,
    password: "Password123!",
    firstName: "Test",
    lastName: "User"
  });
  
  if (signupResult.error) {
    console.error("Failed to create test user:", signupResult.error);
    process.exit(1);
  }
  
  console.log("Test user created successfully with password: Password123!");
  
  // 3. Generate reset token
  console.log("Generating reset token...");
  const resetData = await generateUserResetToken(testEmail);
  if (!resetData) {
    console.error("Failed to generate reset token!");
    process.exit(1);
  }
  
  const { resetToken, user } = resetData;
  console.log(`Generated reset token: ${resetToken}`);
  console.log(`Token expiry: ${user.resetTokenExpiry}`);
  
  // 4. Verify token
  console.log("Verifying token...");
  const verifiedUser = await verifyUserResetToken(resetToken);
  if (!verifiedUser) {
    console.error("Token verification failed!");
    process.exit(1);
  }
  console.log(`Verified token matches user: ${verifiedUser.email}`);
  
  // 5. Reset password with new password
  console.log("Resetting password with new valid password: NewPassword123! ...");
  const resetResult = await resetUserPasswordWithToken(resetToken, "NewPassword123!");
  if (!resetResult.success) {
    console.error("Password reset failed:", resetResult.error);
    process.exit(1);
  }
  console.log("Password reset completed successfully!");
  
  // 6. Verify token is invalidated
  console.log("Verifying token invalidation (should be null in DB)...");
  const checkUser = await prisma.user.findUnique({ where: { email: testEmail } });
  if (checkUser.resetToken !== null || checkUser.resetTokenExpiry !== null) {
    console.error("Token fields were not cleared after reset!");
    process.exit(1);
  }
  console.log("Token fields successfully cleared!");
  
  // 7. Verify login works with new password
  console.log("Verifying login with new password...");
  const loginResult = await verifyLogin({ email: testEmail, password: "NewPassword123!" });
  if (loginResult.error) {
    console.error("Login verification failed with new password:", loginResult.error);
    process.exit(1);
  }
  console.log("Login verification succeeded with new password!");
  
  // 8. Clean up
  await prisma.user.delete({ where: { email: testEmail } }).catch(() => {});
  console.log("Test user cleaned up.");
  console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
}

runTest().catch((e) => {
  console.error("Unhandled test error:", e);
  process.exit(1);
});
