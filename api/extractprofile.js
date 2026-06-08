module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resumeText } = req.body;

  const systemPrompt = `Extract key profile information from a resume. Return ONLY valid JSON, no markdown, no backticks.

Exact structure:
{
  "currentTitle": "Most recent job title",
  "degree": "Highest degree and field e.g. BS Finance, MBA Marketing",
  "background": "2-3 sentence summary of their experience and strengths written in third person",
  "skills": ["up to 5 key professional skills"],
  "industries": ["up to 3 industries they have worked in"]
}

Be concise and accurate. Only use what is actually in the resume.`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Resume:\n${resumeText}` }]
      })
    });

    const data = await claudeRes.json();
    const text = data.content.map(i => i.text || '').join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
