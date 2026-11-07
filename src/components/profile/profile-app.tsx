"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { isFirebaseConfigured, subscribeToAuthChanges, logOut } from "@/lib/firebase";
import { emptyProfile, getStudentProfile, saveStudentProfile, uploadAvatar, type StudentProfile } from "@/lib/profile";
import { ProfileCreatedToast } from "@/components/profile/profile-created-toast";

const roleOptions = ["Frontend developer", "Backend developer", "Full-stack developer", "AI/ML developer", "Data analyst", "UI/UX designer", "Researcher", "Product or presentation lead"];
const categories = ["Programming languages", "Frontend", "Backend", "Databases", "AI/ML and data", "Design and other"];
const inputClass = "w-full rounded-xl border border-white/10 bg-[#101117] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-rose-500/70 focus:ring-2 focus:ring-rose-500/20";
const panelClass = "rounded-2xl border border-white/[0.08] bg-[#12131b]/90 p-5 sm:p-6";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-neutral-200">{label}</span>{children}{hint && <span className="block text-xs text-neutral-500">{hint}</span>}</label>;
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">{children}{onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${children}`} className="text-rose-300 hover:text-white">×</button>}</span>;
}

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
  const [skillName, setSkillName] = useState("");
  const [skillCategory, setSkillCategory] = useState(categories[0]);
  const [skillLevel, setSkillLevel] = useState("Comfortable");
  const [roleInput, setRoleInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profileExists, setProfileExists] = useState(false);
  const saveInFlight = useRef(false);

  useEffect(() => subscribeToAuthChanges((active) => {
    setUser(active);
    if (!active) router.replace(`/sign-in?next=${encodeURIComponent(pathnameRef.current)}`);
  }), [router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getStudentProfile(user).then((saved) => {
      if (!alive) return;
      const next = { ...emptyProfile(user.uid, user.displayName ?? ""), ...(saved ?? {}) } as StudentProfile;
      setProfileExists(Boolean(saved));
      setProfile(next);
      setPhotoPreview(next.photoUrl || "");
      if (!isForm && !next.completed) router.replace("/profile/setup");
      if (isSetup && next.completed) router.replace("/profile");
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Could not load your profile from Supabase.");
    })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user, isForm, isSetup, router]);

  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [profile.fullName, profile.college, profile.degree, profile.branch, profile.academicYear, profile.skills.length ? "yes" : "", profile.roles.length ? "yes" : "", profile.interests.length ? "yes" : "", profile.buildGoal, profile.hoursPerWeek];
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
  }, [profile]);

  if (loading || !user) return <main className="min-h-screen bg-[#070709] p-8 text-neutral-300">{!isFirebaseConfigured ? "Firebase is not configured. Add your Firebase credentials to sign in." : "Loading your profile…"}</main>;
  if (!profile) return <main className="min-h-screen bg-[#070709] p-8 text-neutral-300"><div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#12131b] p-6"><p role="alert">{message || "Could not load your profile."}</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => { setLoading(true); setMessage(""); }} className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5">Retry loading profile</button></div></div></main>;

  const patchProfile = (patch: Partial<StudentProfile>) => setProfile((current) => current ? { ...current, ...patch } : current);
  const addListValue = (field: "roles" | "interests", value: string) => {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const existing = profile[field];
    if (!existing.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) patchProfile({ [field]: [...existing, normalized] });
    if (field === "roles") setRoleInput("");
    else setInterestInput("");
  };
  const addSkill = () => {
    const name = skillName.trim().replace(/\s+/g, " ");
    if (!name || profile.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) return;
    patchProfile({ skills: [...profile.skills, { name, category: skillCategory, level: skillLevel }] });
    setSkillName("");
  };
  const onPhotoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) { setMessage("Choose a JPG, PNG, WebP, or GIF image."); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage("Choose an image smaller than 5 MB."); return; }
    setMessage(""); setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file));
  };
  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save(true);
  };
  const save = async (complete: boolean) => {
    if (saveInFlight.current) return;
    const nextErrors: Record<string, string> = {};
    if (complete && profile.fullName.trim().length < 2) nextErrors.fullName = "Enter your full name (at least 2 characters).";
    if (complete && !profile.college.trim()) nextErrors.college = "Add your college or university.";
    if (complete && !profile.degree.trim()) nextErrors.degree = "Add your degree.";
    if (complete && !profile.branch.trim()) nextErrors.branch = "Add your branch or department.";
    if (complete && !profile.academicYear) nextErrors.academicYear = "Choose your current academic year.";
    if (complete && profile.skills.length === 0) nextErrors.skills = "Add at least one skill.";
    if (complete && profile.roles.length === 0) nextErrors.roles = "Choose or add at least one preferred role.";
    if (complete && profile.interests.length === 0) nextErrors.interests = "Choose or add at least one interest.";
    if (complete && !profile.buildGoal.trim()) nextErrors.buildGoal = "Tell us what you want to build.";
    if (complete && !profile.hoursPerWeek) nextErrors.hoursPerWeek = "Choose your weekly availability.";
    for (const key of ["github", "linkedin", "portfolio"] as const) if (profile[key] && !/^https?:\/\/.+\..+/.test(profile[key])) nextErrors[key] = "Use a complete link starting with https://.";
    if (profile.otherLinks.some((link) => !/^https?:\/\/.+\..+/.test(link))) nextErrors.otherLinks = "Every link should start with https://.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setMessage("Check the highlighted fields and try again."); return; }
    if (!navigator.onLine) { setMessage("You are offline. Reconnect to save your profile."); return; }
    saveInFlight.current = true;
    setSaving(true); setMessage("");
    try {
      let photoUrl = profile.photoUrl;
      if (photoFile) {
        photoUrl = await uploadAvatar(user, photoFile);
      }
      const justCompleted = complete && !profile.completed;
      const saved = await saveStudentProfile(user, { ...profile, fullName: profile.fullName.trim().replace(/\s+/g, " "), photoUrl, completed: complete }, !profileExists);
      setProfileExists(true);
      setProfile(saved); setPhotoFile(null);
      setMessage(complete ? "Profile saved." : "Draft saved. You can finish it anytime.");
      if (complete) router.push(justCompleted ? "/profile?created=1" : "/profile");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save your profile. Try again."); }
    finally { setSaving(false); saveInFlight.current = false; }
  };

  const toggle = (values: string[], value: string, update: (values: string[]) => void) => update(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const textField = (label: string, key: keyof StudentProfile, placeholder = "", required = false) => <Field label={`${label}${required ? " *" : ""}`}><input className={inputClass} value={String(profile[key] ?? "")} placeholder={placeholder} onChange={(event) => patchProfile({ [key]: event.target.value } as Partial<StudentProfile>)} aria-invalid={Boolean(errors[key])} />{errors[key] && <span className="block text-xs text-rose-300">{errors[key]}</span>}</Field>;

  return <main className="min-h-screen bg-[#070709] text-white">
    <div className="mx-auto flex min-h-screen max-w-[1440px]">
      <aside className="hidden w-64 shrink-0 border-r border-white/[0.07] bg-[#0c0d13] p-6 lg:flex lg:flex-col">
        <Link href="/" className="mb-12 inline-flex items-center gap-2 text-lg font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-sm">P</span>PulsePoint</Link>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-neutral-500">Workspace</p>
        <nav className="space-y-1 text-sm"><Link href="/profile" className={`block rounded-xl px-3 py-2.5 ${!isForm ? "bg-rose-500/10 text-rose-200" : "text-neutral-400 hover:bg-white/5"}`}>My profile</Link><Link href="/profile/edit" className={`block rounded-xl px-3 py-2.5 ${isEdit ? "bg-rose-500/10 text-rose-200" : "text-neutral-400 hover:bg-white/5"}`}>Edit profile</Link><Link href="/" className="block rounded-xl px-3 py-2.5 text-neutral-400 hover:bg-white/5">Back to home</Link></nav>
        <div className="mt-auto rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-xs font-medium text-neutral-300">Profile strength</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${completion}%` }} /></div><p className="mt-2 text-xs text-neutral-500">{completion}% complete</p></div>
      </aside>
      <section className="min-w-0 flex-1 px-4 py-5 sm:px-8 lg:px-10 lg:py-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-rose-300">Student workspace</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{isSetup ? "Set up your profile" : isEdit ? "Edit your profile" : "Your profile"}</h1><p className="mt-2 text-sm text-neutral-400">{isSetup ? "Share what you bring to a team. You can update these details anytime." : "A clear snapshot of your skills, goals, and collaboration style."}</p></div><div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-medium">{profile.fullName || user.displayName || "Student"}</span><span className="block max-w-48 truncate text-xs text-neutral-500">{user.email}</span></span><button onClick={() => void logOut()} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/5">Sign out</button></div></header>
        {message && <p role="status" className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">{message}</p>}
        {!isForm ? <><ProfileCreatedToast uid={user.uid} /><ProfileView profile={profile} onEdit={() => router.push("/profile/edit")} completion={completion} /></> : <form onSubmit={submitProfile}>
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#12131b] p-4"><div><p className="text-sm font-semibold">Profile completion</p><p className="mt-1 text-xs text-neutral-500">Optional details can always be skipped.</p></div><span className="text-lg font-bold text-rose-300">{completion}%</span><div className="absolute" /></div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <section className={panelClass}><PanelTitle number="01" title="Photo & basics" note="Start with the details teammates need to know." />
                <div className="mb-6 flex flex-wrap items-center gap-4"><div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-2xl font-semibold text-rose-200">{photoPreview ? <Image src={photoPreview} alt="Profile preview" width={80} height={80} unoptimized className="h-full w-full object-cover" /> : (profile.fullName || user.displayName || "S").slice(0,1).toUpperCase()}</div><div><label className="inline-flex cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10">{photoPreview ? "Replace photo" : "Choose photo"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onPhotoSelected} /></label>{photoPreview && <button type="button" className="ml-3 text-xs text-neutral-400 hover:text-white" onClick={() => { setPhotoPreview(""); setPhotoFile(null); patchProfile({ photoUrl: "" }); }}>Remove</button>}<p className="mt-2 text-xs text-neutral-500">JPG, PNG, WebP, or GIF · up to 5 MB. Preview is local until saved.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Firebase account email"><input className={inputClass} type="email" value={user.email ?? ""} readOnly aria-readonly="true" /></Field>{textField("Full name", "fullName", "Your name", true)}{textField("Short headline", "headline", "CSE student interested in backend development")}{textField("College or university", "college", "University name", true)}{textField("Degree", "degree", "B.Tech, B.Sc, …", true)}{textField("Branch or department", "branch", "Computer Science", true)}<Field label="Current academic year *"><select className={inputClass} value={profile.academicYear} onChange={(e) => patchProfile({ academicYear: e.target.value })} aria-invalid={Boolean(errors.academicYear)}><option value="">Choose year</option>{["1st year","2nd year","3rd year","4th year","5th year","Graduate student"].map((x)=><option key={x}>{x}</option>)}</select>{errors.academicYear && <span className="block text-xs text-rose-300">{errors.academicYear}</span>}</Field>{textField("Expected graduation year", "graduationYear", "2027")}{textField("City or region", "location", "Optional")}</div>
              </section>
              <section className={panelClass}><PanelTitle number="02" title="Skills & experience" note="Skill levels are your own self-assessment, not verified ratings." />
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px_auto]"><input className={inputClass} value={skillName} onChange={(e)=>setSkillName(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&(e.preventDefault(),addSkill())} placeholder="Add a skill" aria-label="Skill name"/><select className={inputClass} value={skillCategory} onChange={(e)=>setSkillCategory(e.target.value)}>{categories.map((x)=><option key={x}>{x}</option>)}</select><select className={inputClass} value={skillLevel} onChange={(e)=>setSkillLevel(e.target.value)}>{["Beginner","Comfortable","Experienced"].map((x)=><option key={x}>{x}</option>)}</select><button type="button" onClick={addSkill} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold hover:bg-rose-500">Add</button></div>
                {errors.skills && <p className="mt-3 text-xs text-rose-300">{errors.skills}</p>}<div className="mt-4 space-y-3">{categories.map((category)=><div key={category}><p className="mb-2 text-xs text-neutral-500">{category}</p><div className="flex flex-wrap gap-2">{profile.skills.filter(s=>s.category===category).map((skill,i)=><Chip key={`${skill.name}-${i}`} onRemove={()=>patchProfile({skills:profile.skills.filter(x=>x!==skill)})}>{skill.name} <span className="text-rose-200/60">· {skill.level}</span></Chip>)}</div></div>)}</div>
              </section>
              <section className={panelClass}><PanelTitle number="03" title="Preferred team roles" note="Choose more than one, or add a role that fits you." /><div className="flex flex-wrap gap-2">{roleOptions.map((role)=><button type="button" key={role} onClick={()=>toggle(profile.roles,role,(roles)=>patchProfile({roles}))} className={`rounded-full border px-3 py-2 text-xs transition ${profile.roles.includes(role)?"border-rose-400/40 bg-rose-500/15 text-rose-100":"border-white/10 text-neutral-400 hover:bg-white/5"}`}>{role}</button>)}</div><div className="mt-4 flex gap-2"><input className={inputClass} value={roleInput} onChange={e=>setRoleInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),addListValue("roles",roleInput))} placeholder="Add another role"/><button type="button" onClick={()=>addListValue("roles",roleInput)} className="rounded-xl border border-white/10 px-4 text-sm hover:bg-white/5">Add</button></div>{errors.roles && <p className="mt-3 text-xs text-rose-300">{errors.roles}</p>}{profile.roles.length>0&&<div className="mt-3 flex flex-wrap gap-2">{profile.roles.map(role=><Chip key={role} onRemove={()=>patchProfile({roles:profile.roles.filter(x=>x!==role)})}>{role}</Chip>)}</div>}</section>
              <section className={panelClass}><PanelTitle number="04" title="Interests & project goals" note="Help future teammates understand what excites you."/><div className="flex flex-wrap gap-2">{["Education","Sustainability","Health","Finance","Developer tools","Community","Accessibility","Creative tech"].map((interest)=><button type="button" key={interest} onClick={()=>toggle(profile.interests,interest,(interests)=>patchProfile({interests}))} className={`rounded-full border px-3 py-2 text-xs ${profile.interests.includes(interest)?"border-rose-400/40 bg-rose-500/15 text-rose-100":"border-white/10 text-neutral-400 hover:bg-white/5"}`}>{interest}</button>)}</div><div className="mt-4 flex gap-2"><input className={inputClass} value={interestInput} onChange={e=>setInterestInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),addListValue("interests",interestInput))} placeholder="Add an interest"/><button type="button" onClick={()=>addListValue("interests",interestInput)} className="rounded-xl border border-white/10 px-4 text-sm hover:bg-white/5">Add</button></div>{errors.interests && <p className="mt-3 text-xs text-rose-300">{errors.interests}</p>}{profile.interests.length>0&&<div className="mt-3 flex flex-wrap gap-2">{profile.interests.map(x=><Chip key={x} onRemove={()=>patchProfile({interests:profile.interests.filter(y=>y!==x)})}>{x}</Chip>)}</div>}<Field label="What I want to build *"><textarea className={`${inputClass} min-h-24 resize-y`} maxLength={500} value={profile.buildGoal} onChange={e=>patchProfile({buildGoal:e.target.value})} placeholder="A simple idea or the kind of problem you want to solve…" aria-invalid={Boolean(errors.buildGoal)}/>{errors.buildGoal && <span className="block text-xs text-rose-300">{errors.buildGoal}</span>}</Field><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Project experience links" hint="Optional links to past work, one URL per line."><textarea className={`${inputClass} min-h-20`} value={profile.experienceLinks.join("\n")} onChange={e=>patchProfile({experienceLinks:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)})} placeholder="https://…"/></Field><Field label="Other project links" hint={errors.otherLinks}><textarea className={`${inputClass} min-h-20`} value={profile.otherLinks.join("\n")} onChange={e=>patchProfile({otherLinks:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)})} placeholder="https://…"/></Field></div></section>
              <section className={panelClass}><PanelTitle number="05" title="Availability & collaboration" note="Let teammates know when and how you can work together."/><div className="grid gap-4 sm:grid-cols-2"><Field label="Approximate hours per week *"><select className={inputClass} value={profile.hoursPerWeek} onChange={e=>patchProfile({hoursPerWeek:e.target.value})} aria-invalid={Boolean(errors.hoursPerWeek)}><option value="">Choose availability</option>{["1–3 hours","4–6 hours","7–10 hours","10+ hours","Flexible"].map(x=><option key={x}>{x}</option>)}</select>{errors.hoursPerWeek && <span className="block text-xs text-rose-300">{errors.hoursPerWeek}</span>}</Field><Field label="Project duration or window"><input className={inputClass} value={profile.duration} onChange={e=>patchProfile({duration:e.target.value})} placeholder="e.g. Summer break, 6 weeks"/></Field></div><p className="mb-2 mt-4 text-sm font-medium text-neutral-200">Collaboration preferences</p><div className="flex flex-wrap gap-2">{["Remote","In person","Async","Scheduled meetings","Flexible"].map(x=><button type="button" key={x} onClick={()=>toggle(profile.collaboration,x,(collaboration)=>patchProfile({collaboration}))} className={`rounded-full border px-3 py-2 text-xs ${profile.collaboration.includes(x)?"border-rose-400/40 bg-rose-500/15 text-rose-100":"border-white/10 text-neutral-400 hover:bg-white/5"}`}>{x}</button>)}</div></section>
              <section className={panelClass}><PanelTitle number="06" title="Links & visibility" note="Your email and private contact details stay private."/><div className="grid gap-4 sm:grid-cols-2">{textField("GitHub", "github", "https://github.com/username")}{textField("LinkedIn", "linkedin", "https://linkedin.com/in/username")}{textField("Portfolio", "portfolio", "https://…")}</div><div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={profile.visibleToStudents} onChange={e=>patchProfile({visibleToStudents:e.target.checked})} className="mt-1 accent-rose-500"/><span><span className="block text-sm font-medium">Show my profile to signed-in PulsePoint students</span><span className="mt-1 block text-xs leading-relaxed text-neutral-500">When enabled, students can see the profile details you share here. Your email remains private. Turn this off to keep your profile visible only to you.</span></span></label></div></section>
            </div>
            <aside className="space-y-4"><div className={`${panelClass} sticky top-5`}><p className="text-xs font-semibold uppercase tracking-[.16em] text-rose-300">Preview</p><h2 className="mt-2 text-lg font-semibold">How teammates see you</h2><p className="mt-1 text-xs text-neutral-500">Your email is always private.</p><div className="my-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white/5 text-lg font-semibold text-rose-200">{photoPreview?<Image src={photoPreview} alt="" width={48} height={48} unoptimized className="h-full w-full object-cover"/>:(profile.fullName||"S").slice(0,1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile.fullName||"Your name"}</p><p className="truncate text-xs text-neutral-500">{profile.headline||"Your headline"}</p></div></div><div className="space-y-4 border-t border-white/[0.07] pt-4 text-sm"><PreviewRow label="Education" value={[profile.degree,profile.branch,profile.college].filter(Boolean).join(" · ")||"Add your education"}/><PreviewRow label="Roles" value={profile.roles.join(", ")||"Choose preferred roles"}/><PreviewRow label="Skills" value={profile.skills.slice(0,5).map(s=>s.name).join(", ")||"Add skills"}/><PreviewRow label="Interests" value={profile.interests.join(", ")||"Add interests"}/></div><button type="button" onClick={()=>setPreview(!preview)} className="mt-5 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium hover:bg-white/5">{preview?"Close full preview":"Preview profile"}</button>{preview&&<div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-4 text-sm"><p className="font-semibold">{profile.fullName||"Your name"}</p><p className="mt-1 text-neutral-400">{profile.headline||"Your headline will appear here."}</p><p className="mt-3 text-xs text-neutral-300">{profile.buildGoal||"Your project goal will appear here."}</p></div>}<div className="mt-5 grid gap-2"><button type="submit" disabled={saving} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold shadow-lg shadow-rose-900/20 transition hover:bg-rose-500 disabled:opacity-60">{saving?"Saving…":"Save profile"}</button><button type="button" disabled={saving} onClick={()=>void save(false)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-neutral-300 hover:bg-white/5 disabled:opacity-60">Save draft</button></div><p className="mt-3 text-center text-[11px] text-neutral-500">Saved to your PulsePoint profile.</p></div></aside>
          </div>
        </form>}
      </section>
    </div>
  </main>;
}

function PanelTitle({number,title,note}:{number:string;title:string;note:string}) { return <div className="mb-5 flex gap-3"><span className="pt-0.5 font-mono text-xs text-rose-300">{number}</span><div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-neutral-500">{note}</p></div></div>; }
function PreviewRow({label,value}:{label:string;value:string}) { return <div><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p><p className="mt-1 text-xs leading-relaxed text-neutral-300">{value}</p></div>; }
function ProfileView({profile,onEdit,completion}:{profile:StudentProfile;onEdit:()=>void;completion:number}) { return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-5"><section className={panelClass}><div className="flex flex-wrap items-center gap-5"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white/5 text-3xl font-semibold text-rose-200">{profile.photoUrl?<Image src={profile.photoUrl} alt="Profile" width={96} height={96} unoptimized className="h-full w-full object-cover"/>:profile.fullName.slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="text-2xl font-bold">{profile.fullName}</p><p className="mt-1 text-sm text-neutral-400">{profile.headline||"Add a short headline"}</p><p className="mt-3 text-xs text-neutral-500">{[profile.degree,profile.branch,profile.college].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-neutral-500">{[profile.academicYear,profile.graduationYear&&`Class of ${profile.graduationYear}`,profile.location].filter(Boolean).join(" · ")}</p></div><button onClick={onEdit} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold hover:bg-rose-500">Edit profile</button></div></section><section className={panelClass}><h2 className="mb-4 text-base font-semibold">Skills & experience</h2><div className="space-y-4">{categories.filter(category=>profile.skills.some(s=>s.category===category)).map(category=><div key={category}><p className="mb-2 text-xs text-neutral-500">{category}</p><div className="flex flex-wrap gap-2">{profile.skills.filter(s=>s.category===category).map(s=><Chip key={s.name}>{s.name}<span className="text-rose-200/60">· {s.level}</span></Chip>)}</div></div>)}</div></section><div className="grid gap-5 md:grid-cols-2"><section className={panelClass}><h2 className="mb-3 text-base font-semibold">Preferred roles</h2><div className="flex flex-wrap gap-2">{profile.roles.map(x=><Chip key={x}>{x}</Chip>)}</div>{!profile.roles.length&&<p className="text-sm text-neutral-500">No roles added yet.</p>}</section><section className={panelClass}><h2 className="mb-3 text-base font-semibold">Interests</h2><div className="flex flex-wrap gap-2">{profile.interests.map(x=><Chip key={x}>{x}</Chip>)}</div>{!profile.interests.length&&<p className="text-sm text-neutral-500">No interests added yet.</p>}</section></div><section className={panelClass}><h2 className="mb-3 text-base font-semibold">What I want to build</h2><p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{profile.buildGoal||"Add a project goal to share what you are excited about."}</p></section><section className={panelClass}><h2 className="mb-3 text-base font-semibold">Availability & collaboration</h2><div className="flex flex-wrap gap-2">{[profile.hoursPerWeek,profile.duration,...profile.collaboration].filter(Boolean).map(x=><Chip key={x}>{x}</Chip>)}</div>{!profile.hoursPerWeek&&!profile.duration&&!profile.collaboration.length&&<p className="text-sm text-neutral-500">Availability details are optional.</p>}</section><section className={panelClass}><h2 className="mb-3 text-base font-semibold">Links</h2><div className="flex flex-wrap gap-4 text-sm text-rose-200">{[["GitHub",profile.github],["LinkedIn",profile.linkedin],["Portfolio",profile.portfolio],...profile.otherLinks.map(x=>["Project",x])].filter((x):x is [string,string]=>Boolean(x[1])).map(([label,url])=><a key={url} href={url} target="_blank" rel="noreferrer" className="hover:text-white">{label} ↗</a>)}</div>{!profile.github&&!profile.linkedin&&!profile.portfolio&&!profile.otherLinks.length&&<p className="text-sm text-neutral-500">No links added yet.</p>}</section></div><aside className={`${panelClass} h-fit`}><p className="text-sm font-semibold">Profile status</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-rose-500" style={{width:`${completion}%`}}/></div><p className="mt-2 text-xs text-neutral-500">{completion}% complete</p><p className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs leading-relaxed text-neutral-400">{profile.visibleToStudents?"Visible to signed-in PulsePoint students. Your email stays private.":"Only visible to you."}</p><p className="mt-4 text-[11px] leading-relaxed text-neutral-600">Familiarity levels are self-assessments and have not been verified.</p></aside></div>; }
