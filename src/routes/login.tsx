import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginForm } from "../components/LoginForm";
import { AnimatedBackground } from "../components/AnimatedBackground";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }: { context: { auth?: { isAuthenticated?: boolean } } }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10">
      <AnimatedBackground />
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-20">
        {/* Left side - Branding */}
        <div className="hidden lg:flex flex-col justify-center items-center space-y-8 text-center">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-white">W</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              Weg Translator
            </h1>
            <p className="text-xl text-muted-foreground max-w-md">
              Transform your documents with AI-powered translation technology
            </p>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Real-time translation</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-secondary rounded-full"></div>
              <span>Multiple file formats</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span>Secure & private</span>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="w-full max-w-md mx-auto">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
