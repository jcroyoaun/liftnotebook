import { useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

// Every set the new logger creates carries a client-generated UUID. The API
// upserts on it (POST /v1/sets is idempotent per client_id), which makes one
// mutation type cover create AND edit — and makes offline replay safe: a
// queued POST that runs twice, or an edit that lands after a reload, always
// converges on the same server row.

export function setKey(s) {
  return s.client_id ?? `srv-${s.id}`
}

export function useSessionBundle(sessionId) {
  const session = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const data = await api.getSession(sessionId)
      const mesoData = await api.getMesocycle(data.session.mesocycle_id)
      const day = (mesoData.days || []).find((d) => d.id === data.session.training_day_id)
      return { session: data.session, sets: data.sets || [], dayExercises: day?.exercises || [] }
    },
    // Always refetch on mount: the restored offline cache must never mask
    // sets logged elsewhere. Offline, the refetch fails and cached data stays.
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const dayId = session.data?.session?.training_day_id
  const suggestions = useQuery({
    queryKey: ['suggestions', dayId],
    queryFn: () => api.getSuggestions(dayId).then((d) => d.suggestions || []),
    enabled: !!dayId,
  })

  return { session, suggestions }
}

// useSyncSet returns (set) => void. Cache updates happen instantly;
// the POST upsert is debounced per set so rapid stepper taps collapse
// into one request.
export function useSyncSet(sessionId) {
  const queryClient = useQueryClient()
  const timers = useRef(new Map())

  const mutation = useMutation({
    mutationKey: ['syncSet'],
    scope: { id: `session-${sessionId}` },
    onSuccess: (data, vars) => {
      // Adopt the server row (id, version) for the matching cache entry.
      const key = vars.client_id ?? `srv-${vars.id}`
      queryClient.setQueryData(['session', sessionId], (old) => {
        if (!old) return old
        return {
          ...old,
          sets: old.sets.map((s) => (setKey(s) === key ? { ...s, ...data.set, client_id: s.client_id } : s)),
        }
      })
    },
  })

  const syncSet = useCallback(
    (set) => {
      // Instant optimistic cache update.
      queryClient.setQueryData(['session', sessionId], (old) => {
        if (!old) return old
        const exists = old.sets.some((s) => setKey(s) === setKey(set))
        return {
          ...old,
          sets: exists ? old.sets.map((s) => (setKey(s) === setKey(set) ? { ...s, ...set } : s)) : [...old.sets, set],
        }
      })

      // Debounced write, one timer per set.
      const key = setKey(set)
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key)
          // The API rejects unknown JSON keys, so each path sends exactly
          // its own shape: POST upsert (client_id) or PATCH by id (legacy).
          const vars = set.client_id
            ? {
                workout_session_id: Number(sessionId),
                exercise_id: set.exercise_id,
                set_number: set.set_number,
                weight: set.weight,
                reps: set.reps,
                rir: set.rir,
                recorded: set.recorded,
                client_id: set.client_id,
              }
            : { id: set.id, weight: set.weight, reps: set.reps, rir: set.rir, recorded: set.recorded }
          mutation.mutate(vars)
        }, 400),
      )
    },
    [queryClient, sessionId, mutation],
  )

  return { syncSet, isPending: mutation.isPending, isPaused: mutation.isPaused }
}

export function useDeleteSet(sessionId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (set) => api.deleteSet(set.id),
    scope: { id: `session-${sessionId}` },
    onMutate: async (set) => {
      queryClient.setQueryData(['session', sessionId], (old) => {
        if (!old) return old
        return { ...old, sets: old.sets.filter((s) => setKey(s) !== setKey(set)) }
      })
    },
  })
}
