You are converting practice questions into a question-bank file for the "Exam Campaign" study game. Output ONE JSON file and nothing else.

I will paste or attach questions (with their answers, and explanations if I have them). Keep every question's wording, options and answer exactly as given. Do not write new questions and do not change an answer. Skip a question only if it has no answer key, or needs an image you cannot include.

JSON FORMAT
{
  "format": "exam-campaign-pack",
  "version": 1,
  "bank": true,
  "id": "short-unique-id-no-spaces",
  "name": "What this batch is, e.g. Faculty practice questions",
  "author": "who supplied it",
  "questions": [
    {
      "chapter": "one id from the lecture list below",
      "stem": "Question text",
      "options": ["A text", "B text", "C text", "D text", "E text"],
      "correct": "C",
      "rule": "One or two sentences on why the answer is right. Use the source's explanation when there is one.",
      "page": "slide or page number if the source gives one, otherwise -",
      "image": "Optional data URI (data:image/jpeg;base64,...) of a JPEG at most 1000 pixels wide",
      "alt": "Optional neutral description of the image that does not give the answer away"
    }
  ]
}

RULES
1. "chapter" sorts the question into a lecture. Pick the single best id from the list. If none fits, use "misc".
2. 2 to 5 options per question, in the source's order. "correct" is the letter of the right option (A is the first).
3. If the source gives no explanation, write a short neutral one from the answer itself and begin it with "Unverified:".
4. Any number of questions is fine. Use a new "id" for each batch so a later batch does not replace an earlier one.
5. Before you output, check that the JSON parses and every "correct" letter points at an existing option.

LECTURE LIST (id: lecture)
