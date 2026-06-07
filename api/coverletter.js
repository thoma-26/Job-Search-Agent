module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobTitle, company, jobSummary, jobSkills, currentTitle, degree, background } = req.body;

  const systemPrompt = `You are an expert cover letter writer. Write a concise, professional, and personalized cover letter based on the candidate's background and the job. 

Rules:
- 3 short paragraphs, no more
- Opening: express genuine interest in the specific role and company, name one specific thing about the company that appeals to you
- Middle: connect 2-3 specific experiences from the candidate's background directly to what the role needs — be concrete, not generic
- Closing: confident call to action, no groveling
- Tone: professional but human — not stiff, not over-enthusiastic
- Do NOT use phrases like "I am writing to express my interest", "I believe I would be a great fit", or "Thank you for your consideration"
- Do NOT include placeholders like [Your Name] or [Date]
- Return ONLY the letter text, nothing else`;

  const userMsg = `Job: ${jobTitle} at ${company}
Job summary: ${jobSummary || 'Not provided'}
Key skills required: ${(jobSkills || []).join(', ')}

Candidate:
Current title: ${currentTitle || 'Not specified'}
Education: ${degree || 'Not specified'}
Background: ${background || 'Not provided'}

Write the cover letter.`;

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
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await claudeRes.json();
    const letter = data.content.map(i => i.text || '').join('').trim();
    res.status(200).json({ letter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
