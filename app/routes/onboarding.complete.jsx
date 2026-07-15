/**
 * Onboarding Step 5 — Complete!
 * 
 * Brief success message, then button to go to dashboard.
 * Marks onboarding as completed.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getUserById, updateUser } from "../lib/auth.server";
import { requireUserId } from "../lib/session.server";
import { getCollectionStats, getActiveGoals } from "../lib/collection.server";

export const loader = async ({ request }) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  if (!user) return redirect("/onboarding/welcome");

  // Mark onboarding as complete
  if (!user.onboardingCompleted) {
    await updateUser(userId, {
      onboardingCompleted: true,
      onboardingStep: 4,
    });
  }

  // Read the real collection count from the CollectionItem store
  // (same source the cabinet/dashboard uses), so the count reflects
  // what the user just logged in the previous step.
  const stats = await getCollectionStats(userId);
  const goals = await getActiveGoals(userId);
  const goalTitle = goals && goals.length > 0 ? goals[0].title : "Full Set";

  return json({
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      isSubscriber: user.isSubscriber,
      ownedCount: stats.owned,
      wishlistCount: stats.wanted,
      percentage: stats.percentage,
      goalTitle,
      subscriptionFormat: user.subscriptionFormat,
    },
  });
};

const NEXT_ITEMS = [
  { icon: "fa-solid fa-table-cells-large", text: "Track and manage your collection across all formats" },
  { icon: "fa-solid fa-magnifying-glass", text: "Discover new elements to add to your collection" },
  { icon: "fa-regular fa-heart", text: "Build and share your wishlist with friends" },
  { icon: "fa-solid fa-trophy", text: "Unlock milestones and achievements as you grow" },
];

export default function OnboardingComplete() {
  const { user } = useLoaderData();

  return (
    <main className="min-h-screen bg-luc-gray flex items-center justify-center py-16 px-4 font-sans text-luc-text">
      <section className="w-full max-w-[760px] bg-white border border-luc-border rounded-card shadow-card p-10 sm:p-14 text-center">
        {/* Success icon */}
        <div className="flex justify-center mb-7">
          <span className="w-20 h-20 rounded-full bg-luc-blue flex items-center justify-center">
            <i className="fa-solid fa-check text-3xl text-white" />
          </span>
        </div>

        {/* Headline */}
        <h1 className="luc-heading text-3xl font-medium mb-3">You're all set, {user.firstName}!</h1>
        <p className="text-base text-gray-500 max-w-[520px] mx-auto mb-10 leading-relaxed">
          We've set up your collection with the elements you logged and personalized your experience around your collecting goal. Your Collector Cabinet is ready.
        </p>

        {/* Summary stats */}
        <section className="grid grid-cols-3 gap-4 mb-10">
          <div className="border border-gray-300 rounded p-5 bg-gray-50">
            <p className="text-2xl font-semibold text-gray-800">{user.ownedCount}</p>
            <p className="text-xs text-gray-500 mt-1">Elements logged</p>
          </div>
          <div className="border border-gray-300 rounded p-5 bg-gray-50">
            <p className="text-2xl font-semibold text-gray-800">{user.goalTitle}</p>
            <p className="text-xs text-gray-500 mt-1">Your collecting goal</p>
          </div>
          <div className="border border-gray-300 rounded p-5 bg-gray-50">
            <p className="text-2xl font-semibold text-gray-800">{user.percentage}%</p>
            <p className="text-xs text-gray-500 mt-1">Table completion</p>
          </div>
        </section>

        {/* What's next */}
        <div className="text-left border border-gray-200 rounded p-6 mb-10 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700 mb-4">What you can do next</p>
          <ul className="space-y-3">
            {NEXT_ITEMS.map((it) => (
              <li key={it.text} className="flex items-start gap-3 text-sm text-gray-600">
                <i className={`${it.icon} text-gray-400 mt-0.5`} />
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Primary CTA */}
        <Link
          to="/app/cabinet"
          className="btn-primary w-full mb-4"
        >
          Go to My Dashboard →
        </Link>
        <Link to="/app/cabinet/periodic-table" className="inline-block text-sm text-luc-blue hover:underline">
          Take a quick tour first
        </Link>
      </section>
    </main>
  );
}
