export async function waitForHealth(url = 'http://localhost:3301/health', timeoutMs = 30000, expectJson = false) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`health ${res.status}`);
      if (expectJson) {
        await res.json();
      }
      return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Health check timed out');
}
