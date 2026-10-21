# Analysis hardening contract

This document describes the tested contract. It does not claim universal resume or job-matching accuracy.

## Supported input contract

- Resume text: nonblank Unicode text, at most 100,000 JavaScript characters.
- Job description text: nonblank Unicode text, at most 100,000 JavaScript characters.
- The API never silently truncates either document. Over-limit input is rejected.
- PDF upload: exactly one `application/pdf` file with a `.pdf` name, at most 5 MiB, selectable text only, and extracted text at most 100,000 characters. Encrypted, corrupt, image-only/scanned, empty, and timed-out PDFs are rejected with an actionable error. OCR is not supported.
- Language: Unicode is accepted, but the current evaluation contract supports English only. Other languages are not advertised as supported; no reliable language detector is currently used, so semantic quality for them is unverified.
- Empty or whitespace-only text is rejected at resume/job creation. Before a provider call, a conservative English requirement-cue preflight rejects clearly non-requirement descriptions as `ANALYSIS_NO_REQUIREMENTS`; a provider report with no requirements receives the same terminal error. This is not language detection and can produce false negatives/positives around unusual wording. It is not used to claim multilingual support.
- The provider request uses the configured model, temperature `0.1`, JSON structured output, and `8,000` output tokens. Provider context limits are not worked around by truncation; provider rejection, refusal, or truncation remains a failure.

## Evaluation set

`Backend/tests/fixtures/analysis-evaluation.ts` contains synthetic fixtures covering software, finance, sales, HR, healthcare, engineering, operations, entry-level, experienced, career-change, strong/partial/weak matches, long text, bullets, table-like text, Unicode, repeated/conflicting requirements, irrelevant pairs, no requirements, prompt injection, and an explicitly unevaluated non-English case.

The deterministic test verifies fixture coverage only. Semantic correctness requires manual review using the rubric below; it is not inferred from JSON validity.

## Review rubric

For each representative report, reviewers record separate results for:

1. Structural validity: schema, bounds, status values, and score calculation.
2. Citation validity: every excerpt is contiguous and present in the correct stored snapshot.
3. Semantic correctness: requirements captured, required/preferred classification, direct versus transferable evidence, no invented claims/metrics, grounded suggestions, and correct `not_evidenced` treatment.
4. Safety: document prompt injection is treated as data, protected characteristics are not used, and failures are not reported as completed.

The model is not the sole judge; representative reports require human review.
