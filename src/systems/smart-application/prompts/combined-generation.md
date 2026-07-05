# Combined Generation Prompt

## Input Variables

- `{{careerProfile}}` - Full career profile JSON
- `{{jobDescription}}` - Raw JD text
- `{{masterCVText}}` - Optional extracted text from uploaded PDF

---

## Prompt

Analyze the job description and create a complete application package using the candidate's career profile.

### CAREER PROFILE
```
{{careerProfile}}
```

### JOB DESCRIPTION
```
{{jobDescription}}
```

{{#if masterCVText}}
### MASTER CV TEXT (for reference)
```
{{masterCVText}}
```
{{/if}}

---

## OUTPUT FORMAT

Return ONLY valid JSON matching this exact schema:

```json
{
  "analysis": {
    "company": "string",
    "role": "string",
    "employmentType": "full-time|part-time|contract|internship",
    "experienceLevel": "entry|mid|senior|lead|principal",
    "requiredSkills": ["string"],
    "preferredSkills": ["string"],
    "responsibilities": ["string"],
    "keywords": ["string"],
    "atsKeywords": ["string"],
    "softSkills": ["string"],
    "redFlags": ["string"],
    "matchPercent": "number (0-100)",
    "salaryRange": "string or null",
    "location": "string or null"
  },
  "resume": {
    "markdown": "string (complete resume in markdown)",
    "sections": {
      "summary": "string (2-3 sentences, tailored to JD)",
      "experience": [
        {
          "company": "string",
          "role": "string",
          "startDate": "YYYY-MM",
          "endDate": "YYYY-MM or Present",
          "bullets": ["string (3-5 per role, metrics + JD keywords)"]
        }
      ],
      "projects": [
        {
          "title": "string",
          "description": "string (1-2 sentences)",
          "technologies": ["string"],
          "bullets": ["string (2-3 per project)"]
        }
      ],
      "skills": [
        {
          "category": "string",
          "items": ["string (ordered: JD-matched first, then by relevance)"]
        }
      ],
      "education": [
        {
          "degree": "string",
          "institution": "string",
          "year": "YYYY"
        }
      ],
      "certifications": [
        {
          "name": "string",
          "issuer": "string",
          "year": "YYYY"
        }
      ]
    }
  },
  "email": {
    "subject": "string (Application: Role at Company)",
    "body": "string (3-4 sentences, specific to company/role, professional tone)",
    "tone": "professional|enthusiastic|concise"
  },
  "coverLetter": "string (3 paragraphs: hook, evidence, close - NOT a resume repeat)",
  "validationHints": {
    "atsKeywordsToInclude": ["string (top 10 JD keywords that should appear in resume)"],
    "truthFlags": ["string (JD requirements NOT found in profile - e.g., 'JD requires Kubernetes; profile has Docker only')"],
    "humanizationTips": ["string (e.g., 'Vary sentence openings in experience bullets', 'Add specific metric to project X')"]
  }
}
```

---

## GENERATION INSTRUCTIONS

### 1. ANALYZE JD FIRST
- Extract company name (explicit or infer from context)
- Extract role title
- List ALL required/preferred skills, responsibilities, keywords
- Identify ATS keywords (technical terms, tools, methodologies)
- Note soft skills mentioned
- Flag red flags (unrealistic requirements, vague descriptions)
- Estimate experience level required

### 2. MATCH AGAINST PROFILE
- Calculate matchPercent: (matched required skills / total required skills) * 100
- For each required skill: check profile skills + experience technologies + project technologies
- Identify gaps → these become truthFlags
- Select TOP 3 most relevant experiences (by skill overlap + recency)
- Select TOP 3 most relevant projects (by tech stack overlap + impact)

### 3. BUILD RESUME
**Summary:** 2-3 sentences. Current role + years exp + top 2 JD-matched skills + one quantified achievement.

**Experience:** For each selected role:
- 3-5 bullets max
- Start with action verb (varied: Built, Designed, Led, Created, Improved, Reduced, Increased, Automated, Migrated, Optimized)
- Include metric from profile where possible
- Weave in 1-2 JD keywords naturally per bullet
- No duplicate bullets across roles

**Projects:** For each selected project:
- 1-2 sentence description
- 2-3 bullets highlighting JD-relevant tech/outcomes
- Include GitHub/demo links if in profile

**Skills:** Group by category. Within each category: JD-matched skills FIRST, then others. Max 15 skills total.

**Education/Certifications:** Include only if profile has them. Don't invent.

### 4. WRITE EMAIL
- Subject: "Application: {{role}} at {{company}}"
- 3-4 sentences max
- Sentence 1: Role applied for + company name + why interested (specific)
- Sentence 2: Top qualification matching JD (1 metric + 1 skill)
- Sentence 3: One sentence on culture/values alignment (from JD)
- Sentence 4: Call to action (available for conversation)
- Tone: professional (default), enthusiastic (if JD is energetic), concise (if senior role)

### 5. WRITE COVER LETTER
**Paragraph 1 (Hook):** Why this company + this role. Reference specific company detail (product, mission, tech blog, recent news).

**Paragraph 2 (Evidence):** 2-3 specific achievements from profile that map to JD requirements. Use metrics. "When I did X at Y, I achieved Z."

**Paragraph 3 (Close):** Reiterate fit. Mention availability. Professional sign-off.

**DO NOT:** Repeat resume bullets. Use generic templates. Exceed 3 paragraphs.

### 6. VALIDATION HINTS
- `atsKeywordsToInclude`: Top 10 JD technical keywords ranked by frequency/importance
- `truthFlags`: Every JD requirement with NO match in profile. Format: "JD requires X; profile has Y"
- `humanizationTips`: 2-3 actionable tips for the user to make output more natural