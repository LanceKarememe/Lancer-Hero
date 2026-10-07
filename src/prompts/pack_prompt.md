You are making a quiz pack for the "Exam Campaign" study game. Output ONE JSON file and nothing else.

SOURCE RULE: use only the lecture slides or notes I give you. Every answer must be supported by a specific slide or page. Do not test outside facts.

JSON FORMAT
{
  "format": "exam-campaign-pack",
  "version": 1,
  "id": "short-unique-id-no-spaces",
  "name": "Full lecture title",
  "short": "Short name (max 16 characters)",
  "author": "who made it",
  "tables_md": "Optional. High-yield tables for the lecture written in Markdown (headings, short paragraphs, pipe tables, lists). Cite the slide or page for each table.",
  "questions": [
    {
      "stem": "Question text. Single best answer.",
      "options": ["A text", "B text", "C text", "D text", "E text"],
      "correct": "C",
      "rule": "One or two sentences that teach why the answer is right, with the slide or page.",
      "page": 12,
      "lo": 1,
      "image": "Optional. A data URI (data:image/jpeg;base64,...) of a JPEG at most 1000 pixels wide.",
      "alt": "Optional. Neutral description of the image that does not give the answer away."
    }
  ]
}

QUESTION RULES
1. At most 50 questions per pack, each tied to a learning objective ("lo" is its number).
2. Exactly 5 options. One best answer. Exam difficulty: prefer short vignettes that make the student apply the fact.
3. Options are brief (45 characters or fewer) and similar in length. The correct answer must never be the longest option.
4. No parentheses in options. No "all of the above" or "none of the above". No duplicate options.
5. The stem must not start with a topic label and must not hint at the answer.
6. Never refer to a figure or image unless it is attached in "image". If an image has labels that give the answer away, cover them first.
7. Numeric options go in ascending order.
8. Spread the correct letters evenly across A to E, with no more than 2 of the same letter in a row.
9. Check every key against the source before you finish. If two options could be defended, rewrite the question.

Before you output, validate that the JSON parses, every question has 5 options, and every "correct" is one of A, B, C, D, E.
