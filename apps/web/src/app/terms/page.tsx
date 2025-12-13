import { Navbar } from "@/components/landing/navbar";
import { TermsOfService } from "@/components/landing/terms";
import { Footer } from "@/components/landing/footer";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Navbar />
            <main>
                <TermsOfService />
            </main>
            <Footer />
        </div>
    );
}
