"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { isFirebaseConfigured, subscribeToAuthChanges, logOut } from "@/lib/firebase";
import {
  emptyProfile,
  getStudentProfile,
  saveStudentProfile,
  uploadAvatar,
  type StudentProfile,
} from "@/lib/profile";
import { ProfileCreatedToast } from "@/components/profile/profile-created-toast";
import { ProfileSidebar } from "@/components/profile/profile-sidebar";
import { ProfileView } from "@/components/profile/profile-view";
import { ProfileForm } from "@/components/profile/profile-form";

export function ProfileApp() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const isSetup = pathname === "/profile/setup";
  const isEdit = pathname === "/profile/edit";
  const isForm = isSetup || isEdit;

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profileExists, setProfileExists] = useState(false);
  const saveInFlight = useRef(false);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((active) => {
      setUser(active);
      if (!active) {
        router.replace(`/sign-in?next=${encodeURIComponent(pathnameRef.current)}`);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Load student profile from Supabase Database
  useEffect(() => {
    if (!user) return;
    let alive = true;

    getStudentProfile(user)
      .then((saved) => {
        if (!alive) return;
        const next = {
          ...emptyProfile(user.uid, user.displayName ?? ""),
          ...(saved ?? {}),
        } as StudentProfile;

        setProfileExists(Boolean(saved));
        setProfile(next);
        setPhotoPreview(next.photoUrl || "");

        if (!isForm && !next.completed) {
          router.replace("/profile/setup");
        }
        if (isSetup && next.completed) {
          router.replace("/profile");
        }
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load your profile from Supabase.",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [user, isForm, isSetup, router]);

  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.fullName,
      profile.college,
      profile.degree,
      profile.branch,
      profile.academicYear,
      profile.skills.length ? "yes" : "",
      profile.roles.length ? "yes" : "",
      profile.interests.length ? "yes" : "",
      profile.buildGoal,
      profile.hoursPerWeek,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile]);

  const patchProfile = (patch: Partial<StudentProfile>) => {
    setProfile((current) => (current ? { ...current, ...patch } : current));
  };

  const onPhotoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !file.type.startsWith("image/") ||
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    ) {
      setMessage("Choose a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }

    setMessage("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onPhotoRemoved = () => {
    setPhotoPreview("");
    setPhotoFile(null);
    patchProfile({ photoUrl: "" });
  };

  const save = async (complete: boolean) => {
    if (saveInFlight.current || !profile || !user) return;

    const nextErrors: Record<string, string> = {};
    if (complete && profile.fullName.trim().length < 2) {
      nextErrors.fullName = "Enter your full name (at least 2 characters).";
    }
    if (complete && !profile.college.trim()) {
      nextErrors.college = "Add your college or university.";
    }
    if (complete && !profile.degree.trim()) {
      nextErrors.degree = "Add your degree.";
    }
    if (complete && !profile.branch.trim()) {
      nextErrors.branch = "Add your branch or department.";
    }
    if (complete && !profile.academicYear) {
      nextErrors.academicYear = "Choose your current academic year.";
    }
    if (complete && profile.skills.length === 0) {
      nextErrors.skills = "Add at least one skill.";
    }
    if (complete && profile.roles.length === 0) {
      nextErrors.roles = "Choose or add at least one preferred role.";
    }
    if (complete && profile.interests.length === 0) {
      nextErrors.interests = "Choose or add at least one interest.";
    }
    if (complete && !profile.buildGoal.trim()) {
      nextErrors.buildGoal = "Tell us what you want to build.";
    }
    if (complete && !profile.hoursPerWeek) {
      nextErrors.hoursPerWeek = "Choose your weekly availability.";
    }

    for (const key of ["github", "linkedin", "portfolio"] as const) {
      if (profile[key] && !/^https?:\/\/.+\..+/.test(profile[key])) {
        nextErrors[key] = "Use a complete link starting with https://.";
      }
    }
    if (profile.otherLinks.some((link) => !/^https?:\/\/.+\..+/.test(link))) {
      nextErrors.otherLinks = "Every link should start with https://.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Check the highlighted fields and try again.");
      return;
    }

    if (!navigator.onLine) {
      setMessage("You are offline. Reconnect to save your profile.");
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    setMessage("");

    try {
      let photoUrl = profile.photoUrl;
      if (photoFile) {
        photoUrl = await uploadAvatar(user, photoFile);
      }

      const justCompleted = complete && !profile.completed;
      const saved = await saveStudentProfile(
        user,
        {
          ...profile,
          fullName: profile.fullName.trim().replace(/\s+/g, " "),
          photoUrl,
          completed: complete,
        },
        !profileExists,
      );

      setProfileExists(true);
      setProfile(saved);
      setPhotoFile(null);
      setMessage(complete ? "Profile saved." : "Draft saved. You can finish it anytime.");

      if (complete) {
        router.push(justCompleted ? "/profile?created=1" : "/profile");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save your profile. Try again.",
      );
    } finally {
      setSaving(false);
      saveInFlight.current = false;
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-[#070709] p-8 text-neutral-300">
        {!isFirebaseConfigured
          ? "Firebase is not configured. Add your Firebase credentials to sign in."
          : "Loading your profile…"}
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#070709] p-8 text-neutral-300">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#12131b] p-6">
          <p role="alert">{message || "Could not load your profile."}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setMessage("");
              }}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5 transition"
            >
              Retry loading profile
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070709] text-white">
      {/* Mobile Top Navigation & Desktop Sidebar */}
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <ProfileSidebar
          pathname={pathname}
          completion={completion}
          userEmail={user.email}
          onSignOut={() => void logOut()}
        />

        {/* Main Content Area */}
        <section className="min-w-0 flex-1 px-4 py-5 sm:px-8 lg:px-10 lg:py-9">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-rose-300">
                Student workspace
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-white">
                {isSetup
                  ? "Set up your profile"
                  : isEdit
                  ? "Edit your profile"
                  : "Your profile"}
              </h1>
              <p className="mt-2 text-sm text-neutral-400">
                {isSetup
                  ? "Share what you bring to a team. You can update these details anytime."
                  : "A clear snapshot of your skills, goals, and collaboration style."}
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <span className="text-right">
                <span className="block text-sm font-medium text-white">
                  {profile.fullName || user.displayName || "Student"}
                </span>
                <span className="block max-w-48 truncate text-xs text-neutral-500">
                  {user.email}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void logOut()}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/5 hover:text-white transition"
              >
                Sign out
              </button>
            </div>
          </header>

          {message && (
            <p
              role="status"
              className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200"
            >
              {message}
            </p>
          )}

          {!isForm ? (
            <>
              <ProfileCreatedToast uid={user.uid} />
              <ProfileView
                profile={profile}
                onEdit={() => router.push("/profile/edit")}
                completion={completion}
              />
            </>
          ) : (
            <ProfileForm
              profile={profile}
              user={user}
              saving={saving}
              completion={completion}
              errors={errors}
              patchProfile={patchProfile}
              onSave={save}
              photoPreview={photoPreview}
              onPhotoSelected={onPhotoSelected}
              onPhotoRemoved={onPhotoRemoved}
            />
          )}
        </section>
      </div>
    </main>
  );
}
