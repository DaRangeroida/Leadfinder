import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { JobEvent, JobLogEntry, SearchJob } from '../../../shared/types.ts';

export interface JobStream {
  job: SearchJob | null;
  log: JobLogEntry[];
  connected: boolean;
}

export function useJobEvents(jobId: number | null): JobStream {
  const queryClient = useQueryClient();
  const [state, setState] = useState<JobStream>({ job: null, log: [], connected: false });

  useEffect(() => {
    setState({ job: null, log: [], connected: false });
    if (jobId == null) return;
    const source = new EventSource(`/api/jobs/${jobId}/events`);

    source.onopen = () => setState((s) => ({ ...s, connected: true }));
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as JobEvent;
      if (event.type === 'job') {
        setState((s) => ({ ...s, job: event.job }));
        if (event.job.status === 'done' || event.job.status === 'error') {
          source.close();
          setState((s) => ({ ...s, connected: false }));
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          queryClient.invalidateQueries({ queryKey: ['filters'] });
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
      } else if (event.type === 'lead') {
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
      } else if (event.type === 'log') {
        setState((s) => ({ ...s, log: [...s.log.slice(-199), event.entry] }));
      }
    };
    source.onerror = () => setState((s) => ({ ...s, connected: false }));

    return () => source.close();
  }, [jobId, queryClient]);

  return state;
}
