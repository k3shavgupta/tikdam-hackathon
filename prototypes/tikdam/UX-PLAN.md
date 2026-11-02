# Tikdam UI exploration

Question: which interaction helps a first-time user describe a business purchase and understand what still needs checking?

Audience: freelancers and small business owners checking a purchase before paying. Primary job: understand the possible tax treatment, the information required, and the evidence to retain.

## Three directions

- Conversation: a guided exchange beside a live purchase sheet. Best for first use and missing information; takes more clicks.
- Guided: one question fills the main workspace, with a compact summary beneath it. Best for mobile and low cognitive load; conceals future questions.
- Worksheet: all inputs in one editable form. Best for repeat visits and comparison; expects more tax vocabulary from the user.

## Visual system

White #FFFFFF and cloud #F2F6FA surfaces, ink #18304A, cobalt #2457D6 for actions, muted slate #56697D for supporting text, and pale blue #E9F0FF for selected states. System sans typography: 48px title, 30px section titles, 16px body, 13px metadata. Use simple document structure and a purchase sheet with one folded corner as the distinctive visual. Main content is left aligned; navigation and result align to a 1200px container. Space distinguishes groups; borders mark editable or inspectable content. Avoid a dashboard grid and decorative financial charts.

## Journey

1. Choose tax jurisdiction, purchase, and price.
2. Supply business-use share and registration status. Show why each question matters.
3. Review editable facts before checking.
4. Read outcome, calculation, conditions, evidence, and sources in that order.
5. Change facts and recheck; clearly stop unsupported jurisdictions.

## Prototype boundaries

All state lives in memory. No API requests or credentials. No tax eligibility decision. The only monetary calculation is price × business-use percentage, clearly labelled as purchase allocation rather than tax savings. Country options illustrate routing only. Source panel explicitly says legal sources and rule versions have not been connected.

## States to review

Empty, partially completed, invalid input, review, result, unsupported country, sources drawer, reset, edited purchase. Keyboard focus is visible; drawers support Escape; motion respects reduced-motion. Mobile uses a single column.

## Next decisions

Choose the interaction style, then choose a narrowly supported tax scenario. Implement the real model and calculator behind validated input contracts. Confirm which sources can support a numerical benefit before introducing a tax-savings amount.
