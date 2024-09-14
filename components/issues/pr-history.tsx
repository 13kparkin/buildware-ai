import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPRHistory } from '@/db/queries/issues-queries'

interface PRHistoryProps {
  issueId: string
}

interface PRHistoryItem {
  id: string
  prLink: string
  createdAt: string
  type: 'initial' | 'update'
}

export const PRHistory: React.FC<PRHistoryProps> = ({ issueId }) => {
  const [history, setHistory] = useState<PRHistoryItem[]>([])

  useEffect(() => {
    const fetchPRHistory = async () => {
      const prHistory = await getPRHistory(issueId)
      setHistory(prHistory)
    }
    fetchPRHistory()
  }, [issueId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>PR History</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p>No PR history available.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((item) => (
              <li key={item.id} className="flex justify-between items-center">
                <a href={item.prLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  {item.type === 'initial' ? 'Initial PR' : 'Update'}
                </a>
                <span className="text-sm text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}