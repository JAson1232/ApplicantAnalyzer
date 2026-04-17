import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';

const FEATURED_DEGREES = [
  {
    university: 'Harvard University',
    degree: 'Master of Business Administration',
    field: 'Business & Management',
    location: 'Cambridge, MA',
    duration: '2 years',
    flag: '🇺🇸',
  },
  {
    university: 'University of Oxford',
    degree: 'Bachelor of Philosophy, Politics & Economics',
    field: 'Humanities & Social Sciences',
    location: 'Oxford, UK',
    duration: '3 years',
    flag: '🇬🇧',
  },
  {
    university: 'MIT',
    degree: 'Bachelor of Science in Computer Science',
    field: 'Engineering & Technology',
    location: 'Cambridge, MA',
    duration: '4 years',
    flag: '🇺🇸',
  },
  {
    university: 'Stanford University',
    degree: 'Master of Science in Artificial Intelligence',
    field: 'Computer Science',
    location: 'Stanford, CA',
    duration: '2 years',
    flag: '🇺🇸',
  },
  {
    university: 'University of Cambridge',
    degree: 'Bachelor of Natural Sciences',
    field: 'Natural Sciences',
    location: 'Cambridge, UK',
    duration: '3 years',
    flag: '🇬🇧',
  },
  {
    university: 'ETH Zurich',
    degree: 'Master of Science in Engineering',
    field: 'Engineering & Technology',
    location: 'Zurich, Switzerland',
    duration: '2 years',
    flag: '🇨🇭',
  },
];

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI-Powered Scoring',
    description:
      'Our intelligent system analyses applications holistically, providing consistent and unbiased scoring across all candidates.',
  },
  {
    icon: '📊',
    title: 'Structured Reviews',
    description:
      'Organise applicant data with a standardised workflow so your admissions team can focus on the strongest candidates.',
  },
  {
    icon: '💡',
    title: 'Clear Insights',
    description:
      'Deep-dive analytics reveal patterns in your applicant pool, helping you make confident and data-driven admissions decisions.',
  },
];

const STATS = [
  { value: '50+', label: 'Universities' },
  { value: '10,000+', label: 'Applications Processed' },
  { value: '200+', label: 'Degree Programmes' },
  { value: '98%', label: 'Accuracy Rate' },
];

export default function HomePage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % FEATURED_DEGREES.length);
        setVisible(true);
      }, 350);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const goToSlide = (index) => {
    if (index === activeIndex) return;
    setVisible(false);
    setTimeout(() => {
      setActiveIndex(index);
      setVisible(true);
    }, 350);
  };

  const degree = FEATURED_DEGREES[activeIndex];

  return (
    <div className="pb-8">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="py-16 text-center">
        <div className="inline-block rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1 text-xs font-medium text-gold-400 mb-6">
          Powered by AI · Trusted by Leading Institutions
        </div>
        <h1 className="font-display text-5xl font-bold leading-tight text-gold-400 md:text-6xl">
          Academic Admissions
          <br />
          <span className="text-slate-100">Intelligence</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Streamline your university admissions with AI-assisted scoring, structured reviews,
          and clear applicant insights. Trusted by leading institutions worldwide.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            to="/register"
            className="rounded-lg bg-gold-500 px-6 py-3 text-base font-semibold text-navy-950 transition hover:bg-gold-400"
          >
            Get Started Free
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-slate-700 px-6 py-3 text-base text-slate-100 transition hover:border-gold-500"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <section className="mb-16 grid grid-cols-2 gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="font-display text-3xl font-bold text-gold-400">{stat.value}</div>
            <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* ── Featured Degrees Carousel ──────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="mb-2 text-center font-display text-3xl font-semibold text-slate-100">
          Featured Programmes
        </h2>
        <p className="mb-8 text-center text-slate-400">
          Discover degrees from world-leading universities
        </p>

        <div className="relative rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-card overflow-hidden">
          {/* Decorative background accent */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent" />

          <div
            style={{ transition: 'opacity 0.35s ease, transform 0.35s ease' }}
            className={visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="inline-block rounded-full bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-400 ring-1 ring-gold-500/20">
                  {degree.field}
                </span>
                <h3 className="mt-3 font-display text-2xl font-semibold text-slate-100 md:text-3xl">
                  {degree.degree}
                </h3>
                <p className="mt-2 text-lg font-medium text-gold-400">
                  {degree.flag} {degree.university}
                </p>
                <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-400">
                  <span>📍 {degree.location}</span>
                  <span>⏱ {degree.duration}</span>
                </div>
              </div>
              <div className="hidden shrink-0 text-7xl opacity-20 md:block select-none">
                {degree.flag}
              </div>
            </div>
          </div>

          {/* Dot navigation */}
          <div className="mt-8 flex justify-center gap-2">
            {FEATURED_DEGREES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === activeIndex
                    ? 'w-6 bg-gold-400'
                    : 'w-2 bg-slate-600 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="mb-2 text-center font-display text-3xl font-semibold text-slate-100">
          Why ApplicantAnalyser?
        </h2>
        <p className="mb-8 text-center text-slate-400">
          Everything your admissions team needs in one platform
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="mt-3 text-lg font-semibold text-gold-400">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="mb-2 text-center font-display text-3xl font-semibold text-slate-100">
          How It Works
        </h2>
        <p className="mb-8 text-center text-slate-400">
          Simple for universities. Easy for applicants.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-gold-400">For Universities</h3>
            <ol className="space-y-3 text-sm text-slate-300">
              {[
                'Register and list your degree programmes',
                'Define entry requirements and criteria',
                'Receive and review AI-scored applications',
                'Make confident admissions decisions',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-xs font-bold text-gold-400">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-gold-400">For Applicants</h3>
            <ol className="space-y-3 text-sm text-slate-300">
              {[
                'Browse available degree programmes',
                'Submit your CV and personal statement',
                'Track your application status in real-time',
                'Receive your admissions decision',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-xs font-bold text-gold-400">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-br from-navy-900 to-navy-800 p-10 text-center">
        <h2 className="font-display text-3xl font-bold text-gold-400">
          Ready to transform admissions?
        </h2>
        <p className="mt-3 text-slate-300">
          Join universities and applicants already using ApplicantAnalyser.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            to="/register"
            className="rounded-lg bg-gold-500 px-6 py-3 font-semibold text-navy-950 transition hover:bg-gold-400"
          >
            Create an Account
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-slate-600 px-6 py-3 text-slate-100 transition hover:border-gold-500"
          >
            Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}
