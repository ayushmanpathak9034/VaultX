'use client';

import { Clock } from 'lucide-react';

export default function TransactionHistory() {
  return (
    <div className="glass rounded-3xl p-8 md:p-10 flex-1 flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-white">Transaction History</h2>
      </div>
      
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-6">
            <Clock className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Coming Soon</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Transaction history feature is under development. Stay tuned for updates!
          </p>
        </div>
      </div>
    </div>
  );
}

