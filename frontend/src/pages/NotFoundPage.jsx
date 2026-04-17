import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mt-20 text-center">
      <h1 className="text-4xl text-gold-400">Page Not Found</h1>
      <Link to="/" className="mt-4 inline-block text-gold-300">
        Return home
      </Link>
    </div>
  );
}
