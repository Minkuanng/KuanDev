export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const input = req.method === 'GET' ? req.query : (req.body || {});
    const url = input.url;
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ status: 'error', message: 'URL không hợp lệ' });
    }

    // Put LINK4M_API in Vercel Environment Variables for production.
    // The fallback keeps the current project working until the env var is added.
    const apiKey = process.env.LINK4M_API || '6a8863ab03c43056dd5d47d4';
    const target = `https://link4m.co/api-shorten/v2?api=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}`;

    const upstream = await fetch(target, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'KuanZGame/1.0' }
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { status: 'error', message: text || 'Link4m trả về dữ liệu không hợp lệ' }; }

    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('Link4m proxy error:', error);
    return res.status(502).json({ status: 'error', message: 'Không kết nối được Link4m: ' + (error?.message || 'Unknown error') });
  }
}
