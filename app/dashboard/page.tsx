"use client";

import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckCircleIcon, ClipboardDocumentListIcon, DocumentCheckIcon, SparklesIcon, UserIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { Shell, SectionTitle, Status } from "@/components/shell";
import { useDemo } from "@/components/workspace-context";
import { PRODUCT_TAGLINE } from "@/lib/brand";

export default function Dashboard() {
  const router = useRouter();
  const { sent, nurseResult, doctorResult, record, outputs } = useDemo();
  const workflow = [
    { label: "Patient intake", value: sent ? "Captured" : "Not started", detail: sent ? "Reception information saved" : "Begin at reception", icon: UserPlusIcon, ready: sent },
    { label: "Nurse documentation", value: nurseResult ? "Captured" : "Pending", detail: nurseResult ? "Transcript analysis available" : "No recording processed", icon: ClipboardDocumentListIcon, ready: Boolean(nurseResult) },
    { label: "Doctor consultation", value: doctorResult ? "Captured" : "Pending", detail: doctorResult ? "Transcript analysis available" : "No recording processed", icon: UserIcon, ready: Boolean(doctorResult) },
    { label: "Clinical record", value: record?.status === "clinician_verified" ? "Verified" : record ? "Review needed" : "Pending", detail: record ? "Record generated from encounter" : "No record generated", icon: DocumentCheckIcon, ready: record?.status === "clinician_verified" },
    { label: "Specialized outputs", value: outputs ? "Available" : "Locked", detail: outputs ? "Generated from verified record" : "Requires clinician verification", icon: CheckCircleIcon, ready: Boolean(outputs) },
  ];

  return <Shell title="Clinical dashboard" eyebrow="Healthcare documentation workflow">
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#103F3C] px-7 py-10 text-white shadow-xl md:px-12 md:py-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl"/>
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em]"><SparklesIcon className="h-3.5 w-3.5"/> Evidence-aware documentation</span>
          <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-[-.04em] md:text-5xl">One patient conversation.<br/><span className="text-teal-200">One verified clinical record.</span><br/>Three specialized outputs.</h2>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-teal-50/75">Reception captures context. Nurse and doctor conversations become traceable documentation. A clinician verifies the record before it is transformed for insurance, pharmacy, and the patient.</p>
          <button onClick={() => router.push("/reception")} className="mt-7 inline-flex items-center gap-3 rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-teal-900 shadow-lg transition hover:-translate-y-0.5">Open patient intake <ArrowRightIcon className="h-4 w-4"/></button>
          <p className="mt-4 text-xs text-teal-100/65">{PRODUCT_TAGLINE}</p>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Current session" title="Workflow status" description="Statuses below reflect information captured in this browser session. No placeholder patient counts or names are shown."/>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{workflow.map(item => <div key={item.label} className="card p-5">
          <div className="flex items-start justify-between"><item.icon className="h-5 w-5 text-teal-700"/><span className={`h-2.5 w-2.5 rounded-full ${item.ready ? "bg-emerald-500" : "bg-slate-300"}`}/></div>
          <p className="mt-5 text-lg font-extrabold">{item.value}</p><p className="mt-1 text-xs font-bold">{item.label}</p><p className="mt-2 text-[10px] leading-4 text-muted">{item.detail}</p>
        </div>)}</div>
      </section>

      <section className="card p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><SectionTitle eyebrow="How it works" title="From conversation to stakeholder-ready information" description="The verified record—not raw AI output—is the single source of truth."/><Status tone="amber">Clinician review required</Status></div>
        <div className="mt-7 grid gap-3 md:grid-cols-5">{["Reception","Nurse conversation","Doctor conversation","Clinician verification","Specialized outputs"].map((step,index)=><div key={step} className="relative rounded-xl border border-line bg-canvas p-4"><span className="text-[10px] font-extrabold text-teal-600">0{index+1}</span><p className="mt-2 text-xs font-bold">{step}</p>{index<4&&<ArrowRightIcon className="absolute -right-5 top-1/2 z-10 hidden h-4 w-4 text-teal-500 md:block"/>}</div>)}</div>
      </section>
      <p className="text-center text-xs text-muted">Clinical decision support only. Does not replace professional judgment.</p>
    </div>
  </Shell>;
}
