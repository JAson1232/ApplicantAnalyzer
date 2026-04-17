import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';

export default function ApplicantDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-gold-400">Applicant Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-xl">Browse degrees</h2>
          <p className="mt-2 text-slate-300">Explore programmes and requirements.</p>
          <Link className="mt-4 inline-block text-gold-400" to="/applicant/degrees">
            Browse degrees →
          </Link>
        </Card>
        <Card>
          <h2 className="text-xl">Track applications</h2>
          <p className="mt-2 text-slate-300">Check AI score progress and outcomes.</p>
          <Link className="mt-4 inline-block text-gold-400" to="/applicant/applications">
            View applications →
          </Link>
        </Card>
        <Card>
          <h2 className="text-xl">Your profile</h2>
          <p className="mt-2 text-slate-300">Manage your saved documents for faster applications.</p>
          <Link className="mt-4 inline-block text-gold-400" to="/applicant/profile">
            View profile →
          </Link>
        </Card>
      </div>
    </div>
  );
}
