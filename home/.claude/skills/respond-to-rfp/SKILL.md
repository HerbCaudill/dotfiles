---
name: respond-to-rfp
description: Use to draft a compliant RFP, RFI, or RFQ response from source documents and a supplied template.
---

# Respond to RFP

## Overview

Use this skill to create a proposal response from a solicitation while preserving the format of an existing template. Prefer duplicating the template first, then editing only the duplicate. Treat formatting preservation and source-document fidelity as first-class requirements.

## Core workflow

Identify the source materials:

- the solicitation: RFP, RFI, RFQ, questionnaire, procurement email, or attachments
- the response template or prior proposal to copy
- the intended output location, if the user specified one

Read the solicitation before drafting:

- Extract client name, project title, due date, reference number, submission instructions, required sections, required attachments, evaluation criteria, demo requirements, technical questions, legal/compliance terms, and any must-answer questions.
- Note ambiguities and assumptions, especially where product, security, deployment, pricing, or legal commitments require human confirmation.

Preserve the template:

- If the template is a Google Doc, copy it first with Drive copy tooling such as `gws-delegated drive files copy` or another available Drive copy action.
- Never edit the original template unless the user explicitly asks.
- Confirm the copied document ID/title before making edits.

Draft into the copied template:

- Replace placeholders using exact, scoped replacements.
- Keep the template's existing cover, tables, headers, footers, fonts, images, and section order unless the user asks to restructure.
- Insert solicitation-specific responses into the most natural existing section, or before the appendix when the solicitation asks for direct written answers.
- Write cautiously around security, hosting, certifications, data residency, AI, legal terms, and pricing. Use "confirm," "review," or "technical discussion" language when the source facts are not certain.

Verify before reporting done:

- Read back the final document.
- Check that no unresolved placeholder tokens remain, such as `REPLACE_`, `TODO`, or bracketed notes.
- Confirm solicitation-specific sections landed in the intended location.
- Check heading/body styles after insertion; Google Docs can cause inserted paragraphs to inherit nearby heading or subtitle styles.
- Return the final document link and a concise summary of what changed.

## Google Workspace CLI

On Herb's Mac, use `gws-delegated` for Drive copy operations that app connectors may not expose. It uses unattended domain-wide delegation and does not depend on a cached interactive login.

Useful commands:

```bash
gws auth status
gws-delegated drive files get --params '{"fileId":"FILE_ID","fields":"id,name,mimeType,parents,webViewLink","supportsAllDrives":true}'
gws-delegated drive files copy --params '{"fileId":"TEMPLATE_ID","fields":"id,name,mimeType,parents,webViewLink","supportsAllDrives":true}' --json '{"name":"NEW_PROPOSAL_TITLE","parents":["PARENT_FOLDER_ID"]}'
```

If `gws-delegated` fails, report the delegated-authentication error. Do not start an interactive OAuth flow unless Herb explicitly asks for authentication diagnostics.

## Drafting guidance

Use the `writing` skill for voice and style. Keep the proposal plain-spoken, specific, and professional rather than polished into generic proposal language.

Keep the proposal confident but not overcommitted. Answer the buyer's questions directly, then connect back to the broader value proposition. For technical or compliance questions, separate standard capabilities from items requiring review.

Prefer this structure for direct written response sections:

- Demonstration coverage
- Hosting and deployment
- Configurability
- Security
- Documentation, support, and SLA
- Recommended next steps

Tailor the structure to the solicitation if it provides a required question order.

## Safety

Do not fabricate certifications, data residency guarantees, deployment models, pricing, legal terms, or client references. If a claim is not verified from source material or existing approved proposal language, mark it for confirmation or use qualified language.
