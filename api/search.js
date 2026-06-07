module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { role, location, exp, stage, industries, skills } = req.body;

  try {
    // Step 1: Fetch real job listings from JSearch
    const query = `${role} in ${location}`;
    const jsearchUrl = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1&page=1&employment_types=FULLTIME`;

    const jsearchRes = await fetch(jsearchUrl, {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });

    const jsearchData = await jsearchRes.json();
    const rawJobs = jsearchData.data ? jsearchData.data.slice(0, 8) : [];

    if (rawJobs.length === 0) {
      return res.status(200).json({
        thinking: 'No listings found for this search. Try broadening your role title or location.',
        jobs: []
      });
    }

    // Step 2: Format listings for Claude to score
    const listingsText = rawJobs.map((job, i) => `
Job ${i + 1}:
Title: ${job.job_title}
Company: ${job.employer_name}
Location: ${job.job_city || ''}, ${job.job_state || job.job_country || ''}
Type: ${job.job_employment_type || 'Full-time'}
Salary: ${job.job_min_salary ? '$' + job.job_min_salary + ' – $' + job.job_max_salary : 'Not listed'}
Description: ${(job.job_description || '').slice(0, 300)}
Apply URL: ${job.job_apply_link || ''}
    `).join('\n---\n');

    // Step 3: Ask Claude to score and summarize the real listings
    const systemPrompt = `You are a job search AI agent. Given real job listings and a candidate profile, score each listing and return structured JSON. Return ONLY valid JSON, no markdown, no backticks.

Exact structure:
{
  "thinking": "2-3 sentence reasoning about these results and how they match the candidate",
  "jobs": [
    {
      "title": "exact job title from listing",
      "company": "exact company name",
      "initials": "2 letter company initials",
      "location": "City, State",
      "type": "Full-time",
      "salary": "salary range or Not listed",
      "fit": "High or Medium or Low",
      "fitReason": "1 sentence why this fits or doesn't fit the candidate",
      "summary": "2-3 sentence plain english summary of what this role does day to day",
      "skills": ["4 key skills extracted from the job description"],
      "posted": "recently",
      "applyUrl": "exact apply URL from listing"
    }
  ]
}

Pick the 4 best matching jobs. Mix fit levels honestly.`;

    const userMsg = `Candidate profile:
- Finance + Accounting degree, Minor in Data Analytics
- 8 months audit/assurance at Big 4 firm
- Seeking: ${role} in ${location}
- Experience level: ${exp}, Company stage preference: ${stage}
- Target industries: ${industries}
- Key skills: ${skills}

Real job listings to score:
${listingsText}

Score and summarize the 4 best matches.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content.map(i => i.text || '').join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(parsed);

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
