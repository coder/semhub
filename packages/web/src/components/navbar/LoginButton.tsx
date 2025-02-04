import { login } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/icons/GithubIcon";

export function LoginButton() {
  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <Button variant="outline" onClick={handleLogin} className="gap-2">
      <GithubIcon className="size-4" />
      Sign In
    </Button>
  );
}
