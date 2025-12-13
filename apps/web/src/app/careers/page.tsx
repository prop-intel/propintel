import { Navbar } from "@/components/landing/navbar";
import { Careers } from "@/components/landing/careers";
import { Footer } from "@/components/landing/footer";

export default function CareersPage() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Navbar />
            <main>
                <Careers />
            </main>
            <Footer />
        </div>
    );
}
