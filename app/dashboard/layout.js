import Sidebar from '@/components/Sidebar'
import TokenSender from './token-sender'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-[#F7F6F2] overflow-hidden">
      <TokenSender />
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
