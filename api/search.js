module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { role, location, exp, stage, industries, skills } = req.body;

  const systemPrompt = `You are a job search AI agent. Given a candidate profile, generate realistic job listings. Return ONLY valid JSON, no markdown, no backticks.

Exact structure:
{
  "thinking": "2-3 sentence reasoning about search strategy",
  "jobs": [
    {
      "title": "Job title",
      "company": "Company name",
      "initials": "2 letter company initials",
      "location": "City, State",
      "type": "Full-time",
      "salary": "$X0,000 – $X0,000",
      "fit": "High",
      "fitReason": "1 sentence why",
      "summary": "2-3 sentence day-to-day description",
      "skills": ["Skill1","Skill2","Skill3","Skill4"],
      "posted": "X days ago"
    }
  ]
}

Generate exactly 4 realistic jobs. Mix of fit levels (2 High, 1 Medium, 1 High or Medium).`;

  const userMsg = `Candidate:
- Finance + Accounting degree, Minor in Data Analytics
- 8 months audit/assurance at Big 4 firm
- Seeking: ${role} in ${location}
- Level: ${exp}, Company stage: ${stage}
- Industries: ${industries}
- Skills: ${skills}

Find 4 matching jobs and score each for fit.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await response.json();
    console.log('Anthropic response status:', response.status);
    console.log('Anthropic data:', JSON.stringify(data).slice(0, 200));
    const text = data.content.map(i => i.text || '').join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(parsed);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
