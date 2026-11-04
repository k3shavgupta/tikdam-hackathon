# Meta Global AI Developer Hackathon submission draft

Prepared on 5 November 2026 for the [Cerebral Valley submission form](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit). This file is copy for review, not evidence that a submission or video exists.

## Form selections

- Team name: Tikdam
- Team member: Keshav Gupta (the account shown in the form)
- Track: Indie Developer Track, if submitting as an individual
- Problem statement: Build for Your World
- Public GitHub Repository: https://github.com/k3shavgupta/tikdam-hackathon
- 3-Minute Demo Video: add the uploaded public or unlisted video URL after recording
- Most Viral Track X post: leave blank unless actually entering that track

## Project Description

Tikdam helps a freelancer or small business answer a practical question before and after a purchase: what should be on the bill, what evidence is missing, and what is the next step? It also helps investigate a gap between a client invoice and the payment received. A payment shortfall is not automatically tax withheld, and an input-tax credit is not a cash refund.

The live app at https://tikdam.xyz opens a conversational checker at https://tikdam.xyz/app. A person chooses a task and location, describes the situation, and receives clarifying questions from Meta's model. The assistant can propose structured updates to the case, but it cannot silently apply them. The user reviews the fields, confirms any invoice details, and runs deterministic checks that produce a source-linked preparation checklist or a conditional result. For a client payment, the app separates the payment gap from evidence of tax deducted and helps request a certificate.

The selector has 250 locations. Eleven have researched preparation guidance; narrow numerical candidate input-tax checks cover only specific India, UK and Singapore cases. Elsewhere Tikdam prepares evidence without claiming a local tax benefit. The app does not check government records, file a return, submit a claim or promise a refund. Invoice AI extraction is currently paused, so bill details can be entered manually.

The public app runs on Cloudflare Workers and D1. The server validates and bounds model output, chooses the official source links, recomputes amounts, and rejects model-supplied statutory confirmations. Chat requires explicit consent and verification. A shared spending ledger caps paid use and can pause AI on uncertain billing. The owner dashboard shows operational activity and estimated usage without storing question text or invoice contents in its records. The manual route remains available when chat is unavailable.

Tikdam was built during the event from an earlier product idea. This repository contains the event implementation and tests. It is an early prototype for preparation and review, not professional tax advice or a filing service.

## Describe your use of Meta products to build the submitted project

Tikdam uses Meta Model API for the optional public text conversation. The model receives recent messages and selected case details after consent and a successful challenge, then returns a bounded intake response and proposed case fields. The server validates that structure, rejects unsupported sources and claims, and leaves every proposed update for the user to apply. For result explanations, the server recomputes the case and lets the model select from server-owned statements and source IDs. Deterministic code controls amounts, invoice confirmation and statutory gates. No model call files a claim or confirms eligibility.

During development, we used fictional cases to evaluate the intake and guardrails. A separate Baseten adapter was tested with the hackathon's Muse Spark Open alias, but the currently deployed production chat uses Meta Model API. Invoice extraction is disabled in production. The application records returned token usage as an estimate and retains a reservation when usage is unknown; these are not provider invoices.

## Why are Meta's models important to your solution?

Invoice and payment problems begin as incomplete stories, not clean form entries. Meta's model lets someone explain the situation in ordinary language and helps ask for the next missing fact. It can turn that exchange into a small, reviewable set of case fields. That reduces the effort of starting a check, while the app's rules and source registry keep tax conclusions outside the model's control. The model is useful for intake and explanation; the user's review and deterministic checks are necessary for a trustworthy next step.

## Partner feedback (150-character field)

Baseten's compatible API eased testing Muse Spark Open; the event-specific model alias mattered. We kept model output reviewable.

## Before pressing Submit

1. Record and upload the three-minute demo in `DEMO.md`; paste its working URL into the form.
2. Check the live site and public repository links after the final release.
3. Review the survey answers personally. They ask for the builder's opinion and experience.
4. Read the form's checkbox granting Meta and Cerebral Valley permission to publish and promote submitted materials. The submitter must decide whether to accept it.
5. Submit before the organizer's stated deadline and verify the confirmation screen. A Git push and this draft are not a submission.
