import { Navbar } from "@/components/landing/navbar";
import { About } from "@/components/landing/about";
import { Footer } from "@/components/landing/footer";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Navbar />
            <main className="pt-16">
                <About />
            </main>
            <Footer />
        </div>
    );
}
