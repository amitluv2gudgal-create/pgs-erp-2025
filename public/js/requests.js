export const loadRequests = async () => {
  const res = await fetch('/api/requests/pending');
  return await res.json();
}