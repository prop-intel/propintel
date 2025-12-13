import { Navbar } from "@/components/landing/navbar";
import { PrivacyPolicy } from "@/components/landing/privacy";
import { Footer } from "@/components/landing/footer";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Navbar />
            <main>
                <PrivacyPolicy />
            </main>
            <Footer />
        </div>
    );
}
