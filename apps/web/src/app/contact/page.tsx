import { Navbar } from "@/components/landing/navbar";
import { Contact } from "@/components/landing/contact";
import { Footer } from "@/components/landing/footer";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Navbar />
            <main>
                <Contact />
            </main>
            <Footer />
        </div>
    );
}
