import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-slate-200">404</h1>
        <h2 className="text-2xl font-semibold text-slate-900 mt-4">Page not found</h2>
        <p className="text-slate-500 mt-2 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button onClick={() => navigate('/')} icon={<Home className="h-4 w-4" />}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
