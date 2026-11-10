import { useEffect, useState } from "react";
import { apiClient, extractError } from "../../api/client";
// Each request is scoped to its path; stale responses cannot overwrite a new screen.
export function useResource<T>(path: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{path: string; data: T | null; error: string | null}>({path: "", data: null, error: null});
  useEffect(() => {
    let current = true;
    apiClient.get<T>(path).then(({data}) => { if (current) setResult({path, data, error: null}); })
      .catch((error) => { if (current) setResult({path, data: null, error: extractError(error, "Không tải được dữ liệu. Vui lòng thử lại.")}); });
    return () => { current = false; };
  }, [path, attempt]);
  return {data: result.path === path ? result.data : null, error: result.path === path ? result.error : null,
    reload: () => { setResult({path: "", data: null, error: null}); setAttempt((v) => v + 1); }};
}
