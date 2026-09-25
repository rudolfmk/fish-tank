"use client";
import Link from "next/link"; import { usePathname } from "next/navigation";
import { stages } from "@/lib/workspace-data"; import { stageIcons } from "./icons";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";
import { HomeIcon } from "@heroicons/react/24/outline";
import { useDemo } from "./workspace-context";

export function Shell({children,title,eyebrow,actions}:{children:React.ReactNode;title:string;eyebrow:string;actions?:React.ReactNode}) {
 const path=usePathname(); const active=stages.findIndex(s=>path.includes(s.key));const {supabaseConnected,syncError}=useDemo();
 return <div className="min-h-screen lg:flex">
  <aside className="border-b border-line bg-[#103F3C] text-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0">
   <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-teal-700"><span className="text-xl font-extrabold">+</span></div><div><p className="font-bold tracking-tight">{PRODUCT_NAME}</p><p className="text-[9px] leading-4 text-teal-100/70">{PRODUCT_TAGLINE}</p></div></div>
   <nav className="flex overflow-x-auto p-3 lg:block lg:p-5"><Link href="/" className={`mb-3 flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${path==="/"?"bg-white text-teal-900":"text-teal-50/70 hover:bg-white/10 hover:text-white"}`}><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><HomeIcon className="h-4 w-4"/></span>Dashboard</Link><p className="mb-5 hidden px-3 text-[10px] font-bold uppercase tracking-[.18em] text-teal-100/50 lg:block">Patient journey</p>{stages.map((s,i)=>{const Icon=stageIcons[s.key as keyof typeof stageIcons];const current=i===active;return <div key={s.key} className="relative flex shrink-0 lg:block"><Link href={s.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${current?"bg-white text-teal-900 shadow-lg":"text-teal-50/70 hover:bg-white/10 hover:text-white"}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${current?"bg-teal-50":"bg-white/10"}`}><Icon className="h-4 w-4"/></span><span className="font-semibold">{s.label}</span>{current&&<span className="ml-auto hidden h-2 w-2 rounded-full bg-teal-500 lg:block"/>}</Link>{i<stages.length-1&&<div className={`mx-auto hidden h-4 w-px lg:block ${i<active?"bg-teal-400":"bg-white/15"}`}/>}</div>})}</nav>
   <div className="absolute bottom-5 left-5 right-5 hidden rounded-xl border border-white/10 bg-white/5 p-4 lg:block"><div className="flex items-center gap-2 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${supabaseConnected?"bg-emerald-400":syncError?"bg-amber-400":"bg-slate-400"}`}/>{supabaseConnected?"Supabase connected":syncError?"Supabase unavailable":"Supabase not configured"}</div><p className="mt-2 text-[11px] leading-5 text-teal-50/55">Private clinical workspace · Clinician review required</p></div>
  </aside>
  <main className="min-w-0 flex-1 lg:ml-64"><header className="sticky top-0 z-20 flex h-20 items-center border-b border-line bg-white/90 px-5 backdrop-blur-xl lg:px-10"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-600">{eyebrow}</p><h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1></div></header>
   <div className="mx-auto max-w-[1500px] p-5 lg:p-10">{actions&&<div className="mb-6 flex justify-end">{actions}</div>}{children}</div>
  </main>
 </div>
}
export function SectionTitle({eyebrow,title,description}:{eyebrow?:string;title:string;description?:string}){return <div>{eyebrow&&<p className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-600">{eyebrow}</p>}<h2 className="mt-1 text-lg font-bold tracking-tight">{title}</h2>{description&&<p className="mt-1 text-sm leading-6 text-muted">{description}</p>}</div>}
export function Status({children,tone="teal"}:{children:React.ReactNode;tone?:"teal"|"amber"|"slate"|"blue"}){const c={teal:"bg-teal-50 text-teal-700",amber:"bg-amber-50 text-amber-700",slate:"bg-slate-100 text-slate-600",blue:"bg-blue-50 text-blue-700"}[tone];return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${c}`}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{children}</span>}
export function NextLink({href,children}:{href:string;children:React.ReactNode}){return <Link href={href} className="btn-primary">{children}<ChevronRightIcon className="h-4 w-4"/></Link>}
