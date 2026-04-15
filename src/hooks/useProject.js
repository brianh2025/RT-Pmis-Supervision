import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useProject — fetches a single project + its latest progress record.
 * Returns: { project, loading, error }
 */
export function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchProject() {
      if (!projectId) {
        setLoading(false);
        return;
      }
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
        .eq('id', projectId)
        .single();

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const records = data.progress_records ?? [];
        const latest = records.sort(
          (a, b) => new Date(b.report_date) - new Date(a.report_date)
        )[0] ?? null;
        setProject({ ...data, latest_progress: latest });
      }

      setLoading(false);
    }

    fetchProject();
  }, [projectId, refreshKey]);

  return { project, loading, error, refetch: () => setRefreshKey(k => k + 1) };
}
