import { Navbar } from "@/components/landing/navbar";
import { EnterpriseConsultation } from "@/components/landing/enterprise";
import { Footer } from "@/components/landing/footer";

export default function EnterprisePage() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Navbar />
            <main>
                <EnterpriseConsultation />
            </main>
            <Footer />
        </div>
    );
}
