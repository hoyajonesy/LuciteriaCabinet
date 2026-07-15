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
        title: "1. About Collector Cabinet",
        content: "Collector Cabinet is a web application that allows collectors to organize, catalog, and manage their collections. The Service may automatically import eligible purchases made through Luciteria.com to help build your digital collection."
    },
    {
        title: "2. Eligibility",
        content: "You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account."
    },
    {
        title: "3. Your Account",
        content: "You are responsible for maintaining the security of your account and password."
    },
    {
        title: "4. Order Synchronization",
        content: "Collector Cabinet automatically synchronizes eligible purchases made through Luciteria.com with your account."
    },
    {
        title: "5. Collection Data",
        content: "You retain ownership of the information you enter into your collection. You grant Periodic LLC a limited license to store and process it solely to operate the Service."
    },
    {
        title: "6. Public Wish Lists",
        content: "Only Wish Lists you intentionally publish are public. Your inventory, purchase history, notes, and other collection information remain private unless you explicitly choose to share them."
    },
    {
        title: "7. Acceptable Use",
        content: "You agree not to misuse the Service, interfere with its operation, or upload unlawful or infringing content."
    },
    {
        title: "8. Intellectual Property",
        content: "Collector Cabinet, including its software, interface, database structure, logos, graphics, product photography, element descriptions, and original content, is owned by Periodic LLC."
    },
    {
        title: "9. Accuracy of Information",
        content: "Collector Cabinet is an organizational and educational tool. Information may not always be complete or current."
    },
    {
        title: "10. Availability",
        content: "We do not guarantee uninterrupted availability and may modify or discontinue features."
    },
    {
        title: "11. Free Service",
        content: "Collector Cabinet is currently free. Optional paid features may be introduced in the future with advance notice."
    },
    {
        title: "12. Disclaimer of Warranties",
        content: "The Service is provided \"as is\" and \"as available.\""
    },
    {
        title: "13. Limitation of Liability",
        content: "To the fullest extent permitted by law, Periodic LLC is not liable for indirect or consequential damages. Liability is limited to USD $100 or the amount paid in the prior 12 months, whichever is greater."
    },
    {
        title: "14. Termination",
        content: "We may suspend or terminate accounts that violate these Terms."
    },
    {
        title: "15. Changes to These Terms",
        content: "We may update these Terms from time to time."
    },
    {
        title: "16. Governing Law",
        content: "These Terms are governed by the laws of the State of Washington."
    },
    {
        title: "17. Contact",
        content: "Periodic LLC\n930M N. 127th Street\nSeattle, WA 98133\nUnited States\nEmail: support@luciteria.com"
    }
];

export default function TermsOfService() {
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
                        Collector Cabinet Terms &amp; Conditions
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
                            Welcome to Collector Cabinet, a web application provided by Periodic LLC ("Periodic LLC," "we," "our," or "us"). By creating an account or using Collector Cabinet, you agree to these Terms &amp; Conditions. If you do not agree, please do not use the Service.
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
