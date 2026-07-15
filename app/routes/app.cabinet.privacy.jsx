import React from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import ConsumerHeader from "../components/ConsumerHeader";
import ConsumerFooter from "../components/ConsumerFooter";

export const loader = async ({ request }) => {
    const userId = await getUserId(request);
    let user = null;
    if (userId) {
        user = await getUserById(userId);
    }
    return json({ isLoggedIn: !!user, user });
};



const SECTIONS = [
    {
        title: "1. Information We Collect",
        content: "We collect account information, collection information, eligible Luciteria purchase history, and technical information necessary to operate the Service."
    },
    {
        title: "2. How We Use Your Information",
        content: "We use your information to operate Collector Cabinet, synchronize purchases, maintain your collection, improve the Service, provide support, detect fraud, and develop new features."
    },
    {
        title: "3. Public Information",
        content: "Only information you intentionally publish through the Public Wish List feature is visible to others. All other collection information remains private."
    },
    {
        title: "4. Cookies",
        content: "We use cookies to maintain login sessions, remember preferences, improve performance, and analyze usage."
    },
    {
        title: "5. Sharing Your Information",
        content: "We do not sell your personal information. Information is shared only with trusted providers or when required by law."
    },
    {
        title: "6. Data Security",
        content: "We use reasonable safeguards but cannot guarantee absolute security."
    },
    {
        title: "7. Data Retention",
        content: "We retain information as needed to provide the Service and comply with legal obligations. Deleting your Collector Cabinet account does not delete Luciteria purchase records retained for business purposes."
    },
    {
        title: "8. Your Choices",
        content: "You may update your information, edit your collection, delete your account, and control Wish List visibility."
    },
    {
        title: "9. Children's Privacy",
        content: "Collector Cabinet is not intended for children under 13."
    },
    {
        title: "10. International Users",
        content: "Information may be processed in the United States."
    },
    {
        title: "11. Changes to This Privacy Policy",
        content: "We may update this Privacy Policy from time to time."
    },
    {
        title: "12. Contact Us",
        content: "Periodic LLC\n930M N. 127th Street\nSeattle, WA 98133\nUnited States\nEmail: support@luciteria.com"
    }
];

export default function PrivacyPolicy() {
    const { isLoggedIn } = useLoaderData();
    const ctaTo = isLoggedIn ? "/app/cabinet" : "/onboarding/welcome?mode=login";
    const ctaLabel = isLoggedIn ? "Dashboard" : "Sign In";

    return (
        <div className="min-h-screen bg-white font-sans text-luc-text">
            <ConsumerHeader ctaTo={ctaTo} ctaLabel={ctaLabel} />

            {/* Hero Banner */}
            <div className="bg-luc-gray py-12 border-b border-luc-border">
                <div className="mx-auto max-w-content px-5 sm:px-page">

                    <h1 className="luc-heading text-4xl font-normal leading-tight sm:text-5xl">
                        Collector Cabinet Privacy Policy
                    </h1>
                    <p className="mt-3 text-base text-luc-muted">
                        Effective Date: <strong>June 10, 2026</strong>
                    </p>
                </div>
            </div>

            {/* Content Layout */}
            <main className="mx-auto max-w-6xl px-6 py-12 sm:px-page">
                <div className="space-y-10">
                    <div className="prose max-w-none text-luc-text leading-relaxed">
                        <p className="text-lg text-luc-text mb-8">
                            Periodic LLC respects your privacy. This Privacy Policy explains how we
                            collect, use, and protect information when you use Collector Cabinet.
                        </p>

                        {SECTIONS.map((sec, i) => (
                            <section
                                key={i}
                                id={`sec-${i + 1}`}
                                className="pt-8 first:pt-0 border-t border-luc-border first:border-0"
                            >
                                <h2 className="font-heading text-2xl font-medium text-luc-ink mb-4">
                                    {sec.title}
                                </h2>
                                <div className="text-base text-luc-text space-y-3 whitespace-pre-line">
                                    {sec.content}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </main>

            <ConsumerFooter />
        </div>
    );
}