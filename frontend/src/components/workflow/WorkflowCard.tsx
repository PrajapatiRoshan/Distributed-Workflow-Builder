import { useNavigate } from 'react-router-dom'
import type { Workflow } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Workflow as WorkflowIcon, MoreVertical, Play, Pencil, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface WorkflowCardProps {
  workflow: Workflow
  onDelete: (id: string) => void
  onRun: (id: string) => void
}

export default function WorkflowCard({ workflow, onDelete, onRun }: WorkflowCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <Card hoverable className="relative">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <WorkflowIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{workflow.name}</h3>
            <p className="text-sm text-slate-500">{formatDate(workflow.updatedAt)}</p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <MoreVertical className="h-5 w-5 text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  navigate(`/workflows/${workflow.id}/edit`)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              {workflow.isPublished && (
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onRun(workflow.id)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Play className="h-4 w-4" />
                  Run
                </button>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(workflow.id)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {workflow.description && (
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{workflow.description}</p>
      )}

      <div className="flex items-center justify-between">
        <Badge variant={workflow.isPublished ? 'success' : 'default'}>
          {workflow.isPublished ? 'Published' : 'Draft'}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
        >
          Open
        </Button>
      </div>
    </Card>
  )
}
