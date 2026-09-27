import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';

export function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <p className="text-lg font-semibold">Page introuvable</p>
      <Link to="/" className="mt-4 inline-block font-medium text-brand-700 underline">Retour au tableau de bord</Link>
    </Card>
  );
}
