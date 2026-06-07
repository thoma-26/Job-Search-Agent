module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resumeText, jobDescription } = req.body;

  const systemPrompt = `You are a resume match analyst. Given a resume and job description, score the match and return ONLY valid JSON, no markdown, no backticks.

Exact structure:
{
  "score": 72,
  "jobTitle": "Job title from description",
  "headline": "One line summary of match quality",
  "summary": "2-3 sentence overall assessment of how well this resume fits the role",
  "matches": ["Skill or experience that matches", "Another match"],
  "gaps": ["Missing skill or requirement", "Another gap"],
  "tips": "2-3 specific, actionable tips to strengthen this application for this exact role"
}

Score from 0-100. Be honest and specific. Base everything on what is actually in the resume vs the job.`;

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
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Resume:\n${resumeText.slice(0, 4000)}\n\nJob Description:\n${jobDescription.slice(0, 2000)}` }]
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
