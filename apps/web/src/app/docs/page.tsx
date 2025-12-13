import { Navbar } from "@/components/landing/navbar";
import { ApiDocs } from "@/components/landing/api-docs";
import { Footer } from "@/components/landing/footer";

export default function ApiDocsPage() {
    return (
        <div className="min-h-screen bg-background font-sans antialiased">
            <Navbar />
            <main>
                <ApiDocs />
            </main>
            <Footer />
        </div>
    );
}
