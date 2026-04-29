export async function fetchJson(url, options = {}, label = "request") {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`[warn] ${label}: ${error.message}`);
    return null;
  }
}
