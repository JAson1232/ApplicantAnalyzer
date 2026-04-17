const DIMENSIONS = [
  { key: 'academic_excellence', label: 'Academic Excellence', weight: '25%' },
  { key: 'relevance_of_experience', label: 'Relevance of Experience', weight: '20%' },
  { key: 'personal_statement_quality', label: 'Personal Statement', weight: '20%' },
  { key: 'hidden_criteria_match', label: 'Criteria Match', weight: '25%' },
  { key: 'intellectual_potential', label: 'Intellectual Potential', weight: '5%' },
  { key: 'document_consistency', label: 'Document Consistency', weight: '5%' },
];

function recommendationStyle(rec) {
  if (!rec) return 'bg-slate-700 text-slate-200';
  if (rec === 'Admit') return 'bg-emerald-700 text-white';
  if (rec === 'Admit with Interview') return 'bg-blue-700 text-white';
  if (rec === 'Waitlist') return 'bg-amber-600 text-white';
  return 'bg-rose-700 text-white';
}

function scoreBarColor(score) {
  if (score >= 8) return 'bg-emerald-500';
  if (score >= 6) return 'bg-amber-400';
  return 'bg-rose-500';
}

function SectionHeading({ children }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </h3>
  );
}

function TagList({ items, color = 'slate' }) {
  if (!items?.length) return <p className="text-sm text-slate-500 italic">None recorded</p>;
  const colorMap = {
    slate: 'bg-slate-800 text-slate-200',
    emerald: 'bg-emerald-900/60 text-emerald-200',
    rose: 'bg-rose-900/60 text-rose-200',
    amber: 'bg-amber-900/60 text-amber-200',
    blue: 'bg-blue-900/60 text-blue-200',
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className={`rounded-full px-3 py-1 text-xs ${colorMap[color]}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items, color }) {
  if (!items?.length) return <p className="text-sm text-slate-500 italic">None recorded</p>;
  const borderMap = {
    emerald: 'border-emerald-700/50 bg-emerald-950/40 text-emerald-100',
    rose: 'border-rose-700/50 bg-rose-950/40 text-rose-100',
    amber: 'border-amber-700/50 bg-amber-950/40 text-amber-100',
    gold: 'border-gold-700/50 bg-gold-950/20 text-gold-100',
  };
  const cls = borderMap[color] || 'border-slate-700 bg-slate-800/50 text-slate-200';
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className={`rounded-lg border px-4 py-2 text-sm ${cls}`}>
          {item}
        </li>
      ))}
    </ul>
  );
}

// ─── Pass 2 sections ────────────────────────────────────────────────────────

function EvaluationHeader({ result }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {result.recommendation && (
        <span className={`rounded-full px-4 py-1 text-sm font-semibold ${recommendationStyle(result.recommendation)}`}>
          {result.recommendation}
        </span>
      )}
      {result.score_label && (
        <span className="rounded-full border border-slate-600 px-4 py-1 text-sm text-slate-300">
          {result.score_label}
        </span>
      )}
    </div>
  );
}

function ComparableProfile({ text }) {
  if (!text) return null;
  return (
    <blockquote className="border-l-4 border-gold-500 pl-4 text-slate-300 italic">
      {text}
    </blockquote>
  );
}

function EvaluatorSummary({ text }) {
  if (!text) return null;
  return (
    <div className="space-y-2">
      {text.split('\n').filter(Boolean).map((para, i) => (
        <p key={i} className="text-sm leading-relaxed text-slate-200">{para}</p>
      ))}
    </div>
  );
}

function DimensionBreakdown({ subScores }) {
  if (!subScores) return null;
  return (
    <div className="space-y-4">
      {DIMENSIONS.map(({ key, label, weight }) => {
        const dim = subScores[key];
        if (!dim) return null;
        const score = dim.score ?? 0;
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-200">
                {label}
                <span className="ml-2 text-xs text-slate-500">({weight})</span>
              </span>
              <span className="font-semibold text-slate-100">{score}/10</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-2 rounded-full transition-all ${scoreBarColor(score)}`}
                style={{ width: `${(score / 10) * 100}%` }}
              />
            </div>
            {dim.reasoning && (
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">{dim.reasoning}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InterviewQuestions({ questions }) {
  if (!questions?.length) return null;
  return (
    <ol className="space-y-2">
      {questions.map((q, i) => (
        <li key={i} className="flex gap-3 rounded-lg border border-blue-800/40 bg-blue-950/30 px-4 py-3 text-sm text-blue-100">
          <span className="font-bold text-blue-400">{i + 1}.</span>
          <span>{q}</span>
        </li>
      ))}
    </ol>
  );
}

// ─── Pass 1 sections ────────────────────────────────────────────────────────

function PersonalStatementPanel({ ps }) {
  if (!ps) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6 text-sm">
        {ps.word_count != null && (
          <div><span className="text-slate-400">Word count: </span><span className="text-slate-200">{ps.word_count}</span></div>
        )}
        {ps.maturity_of_writing && (
          <div><span className="text-slate-400">Writing maturity: </span><span className="capitalize text-slate-200">{ps.maturity_of_writing}</span></div>
        )}
      </div>

      {ps.stated_motivation && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Stated motivation</p>
          <p className="text-sm text-slate-200">{ps.stated_motivation}</p>
        </div>
      )}
      {ps.career_goals_stated && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Career goals</p>
          <p className="text-sm text-slate-200">{ps.career_goals_stated}</p>
        </div>
      )}
      {ps.self_awareness_signals && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Self-awareness signals</p>
          <p className="text-sm text-slate-200">{ps.self_awareness_signals}</p>
        </div>
      )}

      {ps.academic_interests_mentioned?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Academic interests mentioned</p>
          <TagList items={ps.academic_interests_mentioned} color="blue" />
        </div>
      )}
      {ps.relevant_experiences_mentioned?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Experiences referenced</p>
          <TagList items={ps.relevant_experiences_mentioned} color="slate" />
        </div>
      )}
      {ps.standout_moments?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Standout moments</p>
          <BulletList items={ps.standout_moments} color="gold" />
        </div>
      )}
      {ps.red_flags?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Red flags</p>
          <BulletList items={ps.red_flags} color="rose" />
        </div>
      )}
    </div>
  );
}

function TranscriptPanel({ transcript }) {
  if (!transcript) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6 text-sm">
        {transcript.institution_name && (
          <div><span className="text-slate-400">Institution: </span><span className="text-slate-200">{transcript.institution_name}</span></div>
        )}
        {transcript.qualification_type && (
          <div><span className="text-slate-400">Qualification: </span><span className="text-slate-200">{transcript.qualification_type}</span></div>
        )}
        {transcript.overall_gpa_or_grade && (
          <div><span className="text-slate-400">Overall grade: </span><span className="text-slate-200">{transcript.overall_gpa_or_grade}</span></div>
        )}
        {transcript.grade_trend && (
          <div><span className="text-slate-400">Grade trend: </span><span className="capitalize text-slate-200">{transcript.grade_trend}</span></div>
        )}
      </div>

      {transcript.subjects?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Subjects</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Grade</th>
                  <th className="pb-2 pr-4">Level</th>
                  <th className="pb-2">STEM relevance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {transcript.subjects.map((s, i) => (
                  <tr key={i} className="text-slate-200">
                    <td className="py-2 pr-4">{s.subject_name}</td>
                    <td className="py-2 pr-4 font-medium">{s.grade}</td>
                    <td className="py-2 pr-4 capitalize text-slate-400">{s.level ?? '—'}</td>
                    <td className="py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${
                        s.relevance_to_stem === 'high' ? 'bg-emerald-900/50 text-emerald-300' :
                        s.relevance_to_stem === 'medium' ? 'bg-amber-900/50 text-amber-300' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {s.relevance_to_stem}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {transcript.strongest_subjects?.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Strongest subjects</p>
            <TagList items={transcript.strongest_subjects} color="emerald" />
          </div>
        )}
        {transcript.weakest_subjects?.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Weakest subjects</p>
            <TagList items={transcript.weakest_subjects} color="amber" />
          </div>
        )}
      </div>

      {transcript.notable_achievements?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Notable achievements</p>
          <BulletList items={transcript.notable_achievements} color="gold" />
        </div>
      )}
      {transcript.red_flags?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Red flags</p>
          <BulletList items={transcript.red_flags} color="rose" />
        </div>
      )}
    </div>
  );
}

function CvPanel({ cv }) {
  if (!cv) return null;
  return (
    <div className="space-y-4">
      {cv.total_work_experience_months != null && (
        <p className="text-sm text-slate-300">
          Total work experience: <span className="font-medium text-slate-100">{cv.total_work_experience_months} months</span>
        </p>
      )}

      {cv.work_experiences?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Work experience</p>
          <div className="space-y-2">
            {cv.work_experiences.map((w, i) => (
              <div key={i} className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">{w.role}</span>
                  <div className="flex gap-2">
                    <span className="rounded bg-slate-700 px-2 py-0.5 text-xs capitalize text-slate-300">{w.type}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${
                      w.relevance_to_degree === 'high' ? 'bg-emerald-900/50 text-emerald-300' :
                      w.relevance_to_degree === 'medium' ? 'bg-amber-900/50 text-amber-300' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {w.relevance_to_degree} relevance
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{w.organisation}{w.duration_months ? ` · ${w.duration_months} months` : ''}</p>
                {w.description_summary && <p className="mt-1 text-xs text-slate-400">{w.description_summary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {cv.extracurriculars?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Extracurriculars</p>
          <div className="space-y-1">
            {cv.extracurriculars.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-slate-700 px-3 py-2 text-sm">
                <span className="text-slate-200">{e.activity}</span>
                <span className="capitalize text-xs text-slate-400">{e.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {cv.technical_skills?.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Technical skills</p>
            <TagList items={cv.technical_skills} color="blue" />
          </div>
        )}
        {cv.languages?.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Languages</p>
            <TagList items={cv.languages} color="slate" />
          </div>
        )}
      </div>

      {cv.publications_or_projects?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Publications & projects</p>
          <BulletList items={cv.publications_or_projects} color="gold" />
        </div>
      )}
      {cv.awards_and_honours?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Awards & honours</p>
          <TagList items={cv.awards_and_honours} color="emerald" />
        </div>
      )}
      {cv.red_flags?.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Red flags</p>
          <BulletList items={cv.red_flags} color="rose" />
        </div>
      )}
    </div>
  );
}

function CrossDocumentPanel({ signals }) {
  if (!signals) return null;
  return (
    <div className="space-y-3">
      {signals.consistency_score && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Consistency:</span>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold capitalize ${
            signals.consistency_score === 'high' ? 'bg-emerald-900/60 text-emerald-200' :
            signals.consistency_score === 'medium' ? 'bg-amber-900/60 text-amber-200' :
            'bg-rose-900/60 text-rose-200'
          }`}>
            {signals.consistency_score}
          </span>
        </div>
      )}
      {signals.consistency_notes && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Consistency notes</p>
          <p className="text-sm text-slate-200">{signals.consistency_notes}</p>
        </div>
      )}
      {signals.passion_evidence && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Passion evidence</p>
          <p className="text-sm text-slate-200">{signals.passion_evidence}</p>
        </div>
      )}
      {signals.trajectory_narrative && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Overall trajectory</p>
          <p className="text-sm text-slate-200 leading-relaxed">{signals.trajectory_narrative}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ApplicationInsights({ application }) {
  const result = application?.ai_full_result ?? null;
  const extraction = application?.ai_pass1_extraction ?? null;

  if (!result && !extraction) return null;

  return (
    <div className="mt-6 space-y-8">

      {/* Recommendation + score label */}
      {result && <EvaluationHeader result={result} />}

      {/* Comparable profile */}
      {result?.comparable_profile && (
        <div>
          <SectionHeading>Applicant archetype</SectionHeading>
          <ComparableProfile text={result.comparable_profile} />
        </div>
      )}

      {/* Evaluator narrative */}
      {result?.evaluator_summary && (
        <div>
          <SectionHeading>Evaluator's summary</SectionHeading>
          <EvaluatorSummary text={result.evaluator_summary} />
        </div>
      )}

      {/* 6-dimension score breakdown */}
      {result?.sub_scores && (
        <div>
          <SectionHeading>Score breakdown</SectionHeading>
          <DimensionBreakdown subScores={result.sub_scores} />
        </div>
      )}

      {/* Strengths */}
      {result?.strengths?.length > 0 && (
        <div>
          <SectionHeading>Strengths</SectionHeading>
          <BulletList items={result.strengths} color="emerald" />
        </div>
      )}

      {/* Weaknesses */}
      {result?.weaknesses?.length > 0 && (
        <div>
          <SectionHeading>Weaknesses</SectionHeading>
          <BulletList items={result.weaknesses} color="amber" />
        </div>
      )}

      {/* Red flags */}
      {result?.red_flags?.length > 0 && (
        <div>
          <SectionHeading>Red flags</SectionHeading>
          <BulletList items={result.red_flags} color="rose" />
        </div>
      )}

      {/* Standout moments */}
      {result?.standout_moments?.length > 0 && (
        <div>
          <SectionHeading>Standout moments</SectionHeading>
          <BulletList items={result.standout_moments} color="gold" />
        </div>
      )}

      {/* Interview questions */}
      {result?.interview_questions?.length > 0 && (
        <div>
          <SectionHeading>Interview questions to explore</SectionHeading>
          <InterviewQuestions questions={result.interview_questions} />
        </div>
      )}

      {/* ── Extraction details (Pass 1) ── */}
      {extraction && (
        <>
          <div className="border-t border-slate-700 pt-6">
            <p className="mb-6 text-xs uppercase tracking-widest text-slate-500">
              Document extraction details
            </p>

            <div className="space-y-8">
              <div>
                <SectionHeading>Personal statement analysis</SectionHeading>
                <PersonalStatementPanel ps={extraction.personal_statement} />
              </div>

              <div>
                <SectionHeading>Academic transcript</SectionHeading>
                <TranscriptPanel transcript={extraction.transcript} />
              </div>

              <div>
                <SectionHeading>CV & experience</SectionHeading>
                <CvPanel cv={extraction.cv} />
              </div>

              <div>
                <SectionHeading>Cross-document signals</SectionHeading>
                <CrossDocumentPanel signals={extraction.cross_document_signals} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
