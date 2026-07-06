Extract structured job posting information from the following text.

Return ONLY valid JSON with this exact schema:
{
  "title": "Job Title (string, required)",
  "company": "Company Name (string, required, use 'Unknown Company' if not found)",
  "location": "City, State or Remote (string, optional)",
  "locationType": "remote | hybrid | onsite | unspecified",
  "description": "Full job description text (string, required, cleaned of boilerplate)",
  "salaryMin": 50000 (number, optional, annual salary in USD minimum),
  "salaryMax": 120000 (number, optional, annual salary in USD maximum),
  "salaryCurrency": "USD" (string, optional, 3-letter currency code),
  "salaryInterval": "yearly | monthly | hourly | unspecified",
  "roleLevel": "intern | entry | mid | senior | lead | executive",
  "employmentType": "full-time | part-time | contract | internship | temporary",
  "requiredSkills": ["Skill1", "Skill2"] (array of strings, required - extract explicitly mentioned required skills),
  "preferredSkills": ["Skill3"] (array of strings, optional - nice-to-have skills),
  "minExperience": 3 (number, optional, years),
  "education": "Bachelor's in CS or equivalent (string, optional)",
  "deadline": "2025-12-31T00:00:00.000Z (ISO date string, optional, only if an explicit application deadline is mentioned)",
  "benefits": ["Benefit1", "Benefit2"] (array of strings, optional)
}

Rules:
- Extract ONLY information explicitly present in the text. Do NOT invent or infer values.
- For requiredSkills: include ALL explicitly mentioned technical and soft skills required for the role.
- Set locationType based on explicit mentions of "remote", "hybrid", "on-site", "office", "work from home".
- For salary, if a range is given, use salaryMin and salaryMax. If it's a single number, use salaryMin only.
- Convert non-USD salaries to approximate USD if a conversion is mentioned, otherwise note the original currency.
- If a value is truly not present in the text, omit the field (do not use null or empty string).
- The description field should contain the full cleaned job description text.

Job posting text:
