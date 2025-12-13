import { auth } from "@/server/auth";
import { handleAnalyzeUrl } from "@/server/actions/auth";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        // If not authenticated, redirect to login with the analyze_url
        const url = req.nextUrl.searchParams.get("url");
        if (url) {
            return redirect(`/login?analyze_url=${encodeURIComponent(url)}`);
        }
        return redirect("/login");
    }

    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
        return redirect("/dashboard");
    }

    await handleAnalyzeUrl(session.user.id, url);
    return redirect("/dashboard/agent-analysis");
}
