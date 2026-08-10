'use client'
import AdminPanel from '@/views/AdminPanel'
import { useParams } from 'next/navigation'

export default function AdminTabPage() {
  const params = useParams()
  const tab = typeof params?.tab === 'string' ? params.tab : undefined
  return <AdminPanel tabId={tab} />
}
