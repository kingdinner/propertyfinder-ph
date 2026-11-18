# SEARCH_WORKFLOW.md — PropertyFinder PH

## Unified Buy / Rent engine

One `/search` experience. `transaction=sale|rent` switches filter schemas.

### On Buy → Rent

Reset sale-only filters (e.g. financing tags, sale price semantics labels). Load rental categories and rent fields (deposit/advance filters if exposed). Clear incompatible multi-selects.

### On Rent → Buy

Reset rent-only filters. Load sale categories and sale price filters.

## Filter logic

| Case | Logic |
| --- | --- |
| Different filter dimensions | **AND** |
| Multiple values in one multi-select (e.g. categories[]) | **OR** |
| Default exclusions | not APPROVED; not AVAILABLE; archived; expired |

## Capabilities

- Philippine hierarchy: province → city/municipality → barangay.
- Autocomplete API with partial matching (`ILIKE` / trigram).
- Server-side filtering, sorting, pagination.
- URL query persistence; clear one chip; clear all.
- Empty results state with guidance.
- Map and list consume **identical** search query results (same page of IDs).

## Sorting (MVP)

`newest` (approved/published time), `price_asc`, `price_desc`, `beds_desc`.

## Performance

Use indexes from DATABASE_DESIGN. Return accurate `total` counts from SQL `count(*)` with same predicates as the page query. No fake marketplace statistics on the homepage.

## Sample data

Dev seeds labeled “sample data”. Production search never invents rows.
