"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginAction, signupAction } from "@/server/actions/auth";
import { GoogleSignInForm } from "@/components/login/google-signin-form";
import { SubmitButton } from "@/components/login/submit-button";
import Link from "next/link";

interface AuthFormProps {
  error?: string;
  success?: string;
  defaultTab?: "login" | "signup";
  analyzeUrl?: string;
}

export function AuthForm({
  error,
  success,
  defaultTab = "login",
  analyzeUrl,
}: AuthFormProps) {
  // Explicitly type the actions to avoid linter errors
  const handleLogin = loginAction as unknown as
    | string
    | ((formData: FormData) => void);
  const handleSignup = signupAction as unknown as
    | string
    | ((formData: FormData) => void);
  return (
    <Card className="bg-card/90 mt-4 sm:mx-auto sm:w-full sm:max-w-md">
      <CardContent>
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link
            href="/"
            className="mb-6 block text-center text-2xl font-bold transition-all hover:opacity-80"
          >
            BrandSight
          </Link>
          <h2 className="text-foreground text-center text-xl font-semibold">
            Log in or create account
          </h2>
          {error && (
            <div className="bg-destructive/15 text-destructive mt-4 rounded-md p-3 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
              {success}
            </div>
          )}

          <Tabs defaultValue={defaultTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4 space-y-4">
              <form
                action={handleLogin}
                className="my-auto flex h-[280px] flex-col justify-center space-y-4"
              >
                {analyzeUrl && (
                  <input type="hidden" name="analyze_url" value={analyzeUrl} />
                )}
                <div>
                  <Label
                    htmlFor="email-login"
                    className="text-foreground dark:text-foreground text-sm font-medium"
                  >
                    Email
                  </Label>
                  <Input
                    type="email"
                    id="email-login"
                    name="email"
                    autoComplete="email"
                    placeholder="email@example.com"
                    className="mt-2 bg-white/80"
                    required
                  />
                </div>
                <div>
                  <Label
                    htmlFor="password-login"
                    className="text-foreground dark:text-foreground text-sm font-medium"
                  >
                    Password
                  </Label>
                  <Input
                    type="password"
                    id="password-login"
                    name="password"
                    autoComplete="current-password"
                    placeholder="**************"
                    className="mt-2 bg-white/80"
                    required
                  />
                </div>
                <SubmitButton className="mt-4 w-full py-2 font-medium">
                  Sign in
                </SubmitButton>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background text-muted-foreground px-2">
                    or with
                  </span>
                </div>
              </div>

              <GoogleSignInForm analyzeUrl={analyzeUrl} />
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-4">
              <form
                action={handleSignup}
                className="my-auto flex h-[380px] flex-col justify-center space-y-4"
              >
                {analyzeUrl && (
                  <input type="hidden" name="analyze_url" value={analyzeUrl} />
                )}
                <div>
                  <Label
                    htmlFor="name-signup"
                    className="text-foreground dark:text-foreground text-sm font-medium"
                  >
                    Name
                  </Label>
                  <Input
                    type="text"
                    id="name-signup"
                    name="name"
                    autoComplete="name"
                    placeholder="Name"
                    className="mt-2 bg-white/80"
                    required
                  />
                </div>

                <div>
                  <Label
                    htmlFor="email-signup"
                    className="text-foreground dark:text-foreground text-sm font-medium"
                  >
                    Email
                  </Label>
                  <Input
                    type="email"
                    id="email-signup"
                    name="email"
                    autoComplete="email"
                    placeholder="email@example.com"
                    className="mt-2 bg-white/80"
                    required
                  />
                </div>

                <div>
                  <Label
                    htmlFor="password-signup"
                    className="text-foreground dark:text-foreground text-sm font-medium"
                  >
                    Password
                  </Label>
                  <Input
                    type="password"
                    id="password-signup"
                    name="password"
                    autoComplete="new-password"
                    placeholder="Password"
                    className="mt-2 bg-white/80"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <Label
                    htmlFor="confirm-password-signup"
                    className="text-foreground dark:text-foreground text-sm font-medium"
                  >
                    Confirm password
                  </Label>
                  <Input
                    type="password"
                    id="confirm-password-signup"
                    name="confirm-password"
                    autoComplete="new-password"
                    placeholder="Password"
                    className="mt-2 bg-white/80"
                    required
                    minLength={8}
                  />
                </div>

                <SubmitButton className="mt-4 w-full py-2 font-medium">
                  Create account
                </SubmitButton>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-muted-foreground dark:text-muted-foreground mt-4 text-xs">
            By signing in, you agree to our{" "}
            <a href="#" className="underline underline-offset-4">
              terms of service
            </a>{" "}
            and{" "}
            <a href="#" className="underline underline-offset-4">
              privacy policy
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
