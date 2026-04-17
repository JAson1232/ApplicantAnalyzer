const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function apiFetch(path, { method = 'GET', body, token, headers = {}, isFormData = false } = {}) {
  const finalHeaders = {
    ...(!isFormData ? JSON_HEADERS : {}),
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const response = await fetch(path, {
    method,
    headers: finalHeaders,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
  });

  const text = await response.text();
  let data = null;
  try {
    if (text) data = JSON.parse(text);
  } catch {
    // Server returned a non-JSON body (e.g. an nginx error page).
    // Fall through so the !response.ok check below gives a useful message.
  }

  if (!response.ok) {
    throw new Error(data?.error || `Server error (${response.status})`);
  }

  return data;
}
