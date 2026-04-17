import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const linkStyle = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm transition ${
    isActive ? 'bg-gold-500/20 text-gold-400' : 'text-slate-200 hover:text-gold-300'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();

  const links = !user
    ? [
        ['/', 'Home'],
        ['/login', 'Login'],
        ['/register', 'Register']
      ]
    : user.role === 'university'
      ? [
          ['/university/dashboard', 'Dashboard'],
          ['/university/degrees', 'Degrees'],
          ['/university/applications', 'Applications'],
          ['/university/candidates', 'Candidates']
        ]
      : [
          ['/applicant/dashboard', 'Dashboard'],
          ['/applicant/degrees', 'Degrees'],
          ['/applicant/applications', 'Applications'],
          ['/applicant/profile', 'Profile']
        ];

  return (
    <header className="border-b border-slate-800 bg-navy-900/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-display text-xl text-gold-400">
          Applicant Analyser
        </Link>
        <div className="flex items-center gap-2">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={linkStyle}>
              {label}
            </NavLink>
          ))}
          {user && (
            <button
              type="button"
              onClick={logout}
              className="ml-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-gold-500 hover:text-gold-300"
            >
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
