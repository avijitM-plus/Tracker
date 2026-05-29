import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

export default function AppsView() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/reports/today')
      .then(res => res.json())
      .then(json => {
        const apps = json.apps || {};
        const formattedData = Object.keys(apps).map(key => ({
          name: key,
          minutes: Math.max(1, Math.ceil(apps[key] / 60))
        })).filter(item => item.minutes > 0).slice(0, 10);
        setData(formattedData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-full flex flex-col gap-6"
    >
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 backdrop-blur-xl">
        <h3 className="text-xl font-semibold text-slate-100 mb-6">Top Applications Today</h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500">Loading data...</div>
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500">No app data recorded yet.</div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b'}} />
                <YAxis stroke="#64748b" tick={{fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#1e293b'}}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
