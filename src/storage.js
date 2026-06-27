import { BIN_URL, BIN_KEY } from './config';

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Master-Key': BIN_KEY,
};

export const loadData = async () => {
  const res = await fetch(`${BIN_URL}/latest`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  const json = await res.json();
  return json.record;
};

export const saveData = async (data) => {
  const res = await fetch(BIN_URL, {
    method:  'PUT',
    headers: HEADERS,
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
};
