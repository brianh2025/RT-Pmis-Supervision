import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useProjects — fetches all projects + their latest progress record.
 * Returns: { projects, loading, error, refresh }
 */
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select(`
          *,
          progress_records (
            report_date,
            planned_progress,
            actual_progress,
            notes
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const withLatestProgress = data.map((project) => {
          const records = project.progress_records ?? [];
          const latest = records
            .filter(r => r.actual_progress > 0)
            .sort((a, b) => new Date(b.report_date) - new Date(a.report_date))[0] ?? null;
          if (latest) {
            latest.actual_progress  = parseFloat(latest.actual_progress.toFixed(2));
            latest.planned_progress = parseFloat(latest.planned_progress.toFixed(2));
          }
          return { ...project, latest_progress: latest };
        });
        setProjects(withLatestProgress);
      }

      setLoading(false);
    }

    fetchProjects();
  }, [tick]);

  return { projects, loading, error, refresh };
}
