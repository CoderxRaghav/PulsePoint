"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  EyeOffIcon,
  PulsePointWordmark,
  CloseIcon,
  GoogleIcon,
  GithubIcon,
  CheckCircleIcon,
} from "@/components/ui/icons";
import {
  signInWithGoogle,
  signInWithGithub,
  subscribeToAuthChanges,
  getAuthInitializationError,
  logOut,
  isFirebaseConfigured,
} from "@/lib/firebase";
import type { User } from "firebase/auth";
import { profileDestination } from "@/lib/profile";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isGithubSigningIn, setIsGithubSigningIn] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: "info" | "error" | "success";
    text: string;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const authAttemptInProgress = useRef(false);
  const routingForUid = useRef<string | null>(null);

  const continueToProfile = useCallback(async (user: User) => {
    if (routingForUid.current === user.uid) return;
    routingForUid.current = user.uid;
    try {
      router.replace(await profileDestination(user));
    } catch (error) {
      routingForUid.current = null;
      setStatusMessage({
        type: "error",
        text: `Firebase sign-in succeeded, but profile database access failed: ${error instanceof Error ? error.message : "Please check your Supabase setup."}`,
      });
    }
  }, [router]);

  // Subscribe to real-time Firebase Authentication state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      if (user) {
        setStatusMessage(null);
        void continueToProfile(user);
      } else {
        const initializationError = getAuthInitializationError();
        if (initializationError) setStatusMessage({ type: "error", text: initializationError });
      }
    });
    return () => unsubscribe();
  }, [continueToProfile]);

  const validate = () => {
    const newErrors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name.trim()) {
      newErrors.name = "Full name is required.";
    } else if (name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters.";
    }

    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid university or personal email.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setStatusMessage({
        type: "info",
        text: "Registration fields validated. Google sign-in is active below via Firebase Authentication.",
      });
    }, 500);
  };

  const handleGoogleSignUp = async () => {
    if (authAttemptInProgress.current) return;
    authAttemptInProgress.current = true;
    setStatusMessage(null);
    setIsGoogleSigningIn(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        if (!currentUser) setStatusMessage({ type: "error", text: result.error || "Google sign-in could not be completed." });
      } else if (result.user) {
        await continueToProfile(result.user);
      }
    } finally {
      authAttemptInProgress.current = false;
      setIsGoogleSigningIn(false);
    }
  };

  const handleGithubSignUp = async () => {
    if (authAttemptInProgress.current) return;
    authAttemptInProgress.current = true;
    setStatusMessage(null);
    setIsGithubSigningIn(true);
    try {
      const result = await signInWithGithub();
      if (!result.success) {
        setStatusMessage({ type: "error", text: result.error || "GitHub sign-in could not be completed." });
      } else if (result.user) {
        await continueToProfile(result.user);
      }
    } finally {
      authAttemptInProgress.current = false;
      setIsGithubSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logOut();
    setStatusMessage({
      type: "info",
      text: "You have been signed out.",
    });
  };

  // If already authenticated via Firebase, render verified authenticated state
  if (currentUser) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          Welcome to PulsePoint
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Your Firebase account is connected
        </p>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Registered Account
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {currentUser.displayName || "PulsePoint Student"}
          </p>
          <p className="text-xs text-slate-600">{currentUser.email}</p>
        </div>

        {statusMessage && (
          <p role="status" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left text-xs text-rose-900">
            {statusMessage.text}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void continueToProfile(currentUser)}
            className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-md shadow-rose-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Continue to PulsePoint
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Mobile Brand Wordmark */}
      <div className="md:hidden mb-6 flex justify-center">
        <Link href="/" aria-label="PulsePoint Home">
          <PulsePointWordmark darkText className="text-xl" />
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          Start finding teammates for your next idea.
        </p>
      </div>

      {/* Status Notice Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`mb-5 p-4 rounded-xl text-xs leading-relaxed flex items-start justify-between gap-3 border ${
            statusMessage.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-0.5 rounded opacity-70 hover:opacity-100"
            aria-label="Dismiss message"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* OAuth Sign-Up Buttons */}
      <div className="mb-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isGoogleSigningIn || isGithubSigningIn}
          className="w-full py-3 px-4 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-center gap-3 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <GoogleIcon className="w-5 h-5 shrink-0" />
          <span>
            {isGoogleSigningIn ? "Connecting with Google..." : "Continue with Google"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleGithubSignUp}
          disabled={isGoogleSigningIn || isGithubSigningIn}
          className="w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-slate-900 border border-slate-700 hover:bg-slate-800 active:bg-slate-950 transition-colors flex items-center justify-center gap-3 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <GithubIcon className="w-5 h-5 shrink-0" />
          <span>
            {isGithubSigningIn ? "Connecting with GitHub..." : "Continue with GitHub"}
          </span>
        </button>

        {!isFirebaseConfigured && (
          <p className="text-[11px] text-amber-700 leading-normal text-center">
            Note: Firebase credentials are not yet set in <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">.env.local</code>.
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
            or register with email
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleEmailSubmit} noValidate className="space-y-3.5">
        {/* Full Name Field */}
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Maya Lin"
            aria-invalid={errors.name ? "true" : "false"}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-white border text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
              errors.name
                ? "border-rose-500 focus:border-rose-500"
                : "border-slate-300 hover:border-slate-400 focus:border-rose-500"
            }`}
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-xs text-rose-600 font-medium">
              {errors.name}
            </p>
          )}
        </div>

        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="you@university.edu"
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-white border text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
              errors.email
                ? "border-rose-500 focus:border-rose-500"
                : "border-slate-300 hover:border-slate-400 focus:border-rose-500"
            }`}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-rose-600 font-medium">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password Field with Show/Hide Toggle */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="At least 8 characters"
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={`w-full pl-3.5 pr-11 py-2.5 rounded-xl text-sm bg-white border text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
                errors.password
                  ? "border-rose-500 focus:border-rose-500"
                  : "border-slate-300 hover:border-slate-400 focus:border-rose-500"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="mt-1 text-xs text-rose-600 font-medium">
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password Field with Show/Hide Toggle */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              placeholder="Re-enter your password"
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              className={`w-full pl-3.5 pr-11 py-2.5 rounded-xl text-sm bg-white border text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
                errors.confirmPassword
                  ? "border-rose-500 focus:border-rose-500"
                  : "border-slate-300 hover:border-slate-400 focus:border-rose-500"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="confirmPassword-error" className="mt-1 text-xs text-rose-600 font-medium">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Guidelines / Privacy Acknowledgement */}
        <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
          By creating an account, you agree to our{" "}
          <Link href="/#how-it-works" className="text-rose-600 hover:underline">
            Community Guidelines
          </Link>{" "}
          and acknowledge our{" "}
          <Link href="/#features" className="text-rose-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition-all shadow-md shadow-rose-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>
      </form>

      {/* Footer Switch to Sign In */}
      <div className="mt-7 pt-5 border-t border-slate-100 text-center">
        <p className="text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-rose-600 hover:text-rose-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
