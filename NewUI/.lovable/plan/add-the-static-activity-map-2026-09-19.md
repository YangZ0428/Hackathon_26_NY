# Add the static activity map

## Scope
- Keep the current calendar, navigation, profile, login, conditions, chat, and recommendation content unchanged.
- Add one compact visual-only map directly below the existing activity cards.

## Map design
- Draw a responsive, lightweight mock neighborhood map using local markup and styling only: pale land, subtle roads, a small lake/park area, minimal labels, and no external map service.
- Show Maya’s approximate location plus labeled markers for Lakeside Park, the bike trail, and the indoor workout location.
- Visually select Lakeside walk in both its activity card and map marker, with a highlighted walking route connecting Maya to Lakeside Park.
- Present “Lakeside Park · Walk 12 min · 0.8 mi” as the active destination summary.

## Directions
- Add a compact ranked travel-method list beneath the map: walking recommended first, biking second, with concise context based on comfortable conditions and asthma.
- Add a non-functional “Open directions” button with an external-link icon.
- Include an explicit code comment marking the whole static module as the replacement point for a future dynamic map implementation.

## Verification
- Check desktop and mobile layouts to ensure the map remains secondary, readable, and free of overlap.
- Confirm the placeholder controls do not navigate or invoke external services.
