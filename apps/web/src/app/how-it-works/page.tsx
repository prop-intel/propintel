import { Navbar } from "@/components/landing/navbar";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Footer } from "@/components/landing/footer";

export default function HowItWorksPage() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Navbar />
            <main>
                <HowItWorks />
            </main>
            <Footer />
        </div>
    );
}
