"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function validate(): boolean {
    const errors: FieldErrors = {};

    if (!name.trim()) {
      errors.name = "Name is required";
    } else if (name.trim().length > 100) {
      errors.name = "Name must be under 100 characters";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (password.length > 100) {
      errors.password = "Password must be under 100 characters";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) {
      setFieldErrors((p) => ({ ...p, [field]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.fieldErrors) {
          const serverErrors: FieldErrors = {};
          for (const [key, msgs] of Object.entries(data.fieldErrors)) {
            if (key in serverErrors || ["name", "email", "password"].includes(key)) {
              serverErrors[key as keyof FieldErrors] = Array.isArray(msgs) ? msgs[0] : String(msgs);
            }
          }
          setFieldErrors(serverErrors);
        }
        setError(data?.error || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      setLoading(false);

      if (result?.error) {
        setError("Account created but sign-in failed. Please sign in manually.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setLoading(false);
      setError("Something went wrong. Please check your connection and try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      <div>
        <Input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError("name");
          }}
          className={`border-border bg-input h-12 rounded-[var(--radius-pill)] px-5 ${fieldErrors.name ? "border-destructive" : ""}`}
        />
        {fieldErrors.name && (
          <p className="text-destructive mt-1 pl-5 text-xs">{fieldErrors.name}</p>
        )}
      </div>
      <div>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError("email");
          }}
          className={`border-border bg-input h-12 rounded-[var(--radius-pill)] px-5 ${fieldErrors.email ? "border-destructive" : ""}`}
        />
        {fieldErrors.email && (
          <p className="text-destructive mt-1 pl-5 text-xs">{fieldErrors.email}</p>
        )}
      </div>
      <div>
        <Input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError("password");
          }}
          className={`border-border bg-input h-12 rounded-[var(--radius-pill)] px-5 ${fieldErrors.password ? "border-destructive" : ""}`}
        />
        {fieldErrors.password && (
          <p className="text-destructive mt-1 pl-5 text-xs">{fieldErrors.password}</p>
        )}
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-[var(--radius-pill)] shadow-[10px_9px_22px_rgba(20,78,227,0.38)]"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Create Account
      </Button>
    </form>
  );
}
