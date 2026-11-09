---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-86]
branch: feature/category-dropdown
tool: Claude Code
pr: none
status: done
---

# The category dropdown (QA review V11, part 1 of 2)

## Instruction

Part of "Lets fix all the visual problems at once", every pull request in one stack. V11: categories show as many chips; make them a dropdown with an icon for each category. While planning, Sofia chose a list that unfolds inline below the field rather than a bottom sheet. This pull request adds the component; the next one uses it in the forms.

## What was done

* `shared/ui/components/Dropdown.tsx`: a field like the text field (label above, 56 px light blue field, icon tile of the choice, chevron that turns), a tap unfolds the list below it (about 5 rows, the rest scroll, `nestedScrollEnabled` for forms inside a scroll view), each row with its icon and a check on the choice; picking folds it back. Optional first row that clears the choice ("Sin categoría"). Fade in and out and the chevron turn, none with Reduce Motion. The field is a button with its expanded state, the rows are radios.
* `shared/ui/icons/categoryIcons.ts`: M7's full category icon map moves here, with `categoryOptions(ids?)`. `modules/transactions/ui/categoryIcons.ts` re-exports it, so the movement rows keep their icons.
* `Dropdown.test.tsx`: 7 tests (closed and open state, picking, placeholder, clearing row, theme colors, an icon for every category, the options). Catalog story.
* `docs/design/README.md`: the component is listed as new, needs design review.

## Result

* Tests: 2755 of 2755. Typecheck and ESLint clean.
* Pull request: not opened yet (opened with the whole stack).

## Decisions and problems

* Inline instead of a sheet: the movement form is already a sheet, and a second sheet over it would hide what the person is filling in.

## Next step

Use the dropdown in the movement, recurring, goal and cap forms (part 2).
