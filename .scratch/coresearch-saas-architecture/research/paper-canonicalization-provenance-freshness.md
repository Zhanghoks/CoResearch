# Paper Canonicalization, Provenance & Rate/Cost Planning — Research Note

Internal engineering research note for CoResearch's literature search / citation feature. All facts below are pulled from official docs/developer pages, cited inline. Access date for all sources: **2026-09-19**.

---

## 1. Candidate external literature APIs

### Semantic Scholar Academic Graph (S2AG) API
- **API key**: Not required for most endpoints. Public/unauthenticated access is allowed but rate-limited to **1000 requests/second shared among ALL unauthenticated users globally** (a pooled, unpredictable limit) — "Requests may also be further throttled during periods of heavy use."
  Source: https://www.semanticscholar.org/product/api (accessed 2026-09-19)
- **With API key**: introductory authenticated rate is **1 request/second per key**, dedicated (not shared), across all endpoints. Best practice per S2 docs: always send the key. Higher limits available on request/review.
  Source: https://www.semanticscholar.org/product/api (accessed 2026-09-19)
- **Field coverage** (Graph API `/paper` endpoint, selectable fields): abstract, authors, venue, citations, references, `externalIds` (DOI, PubMed, PubMedCentral, ArXiv, MAG, DBLP, ACL, CorpusId), `openAccessPdf`, `tldr`.
  Source: https://api.semanticscholar.org/api-docs/graph (accessed 2026-09-19)
- **Citation graph**: native first-class feature — this is S2's core differentiator (citations/references embedded directly in paper objects).

### OpenAlex
- **API key**: Not required for free tier. "You don't need an API key to use OpenAlex." Premium/paid subscribers get keys for higher limits + special filters.
  Source: https://github.com/ourresearch/openalex-docs/blob/main/how-to-use-the-api/rate-limits-and-authentication.md (mirrors docs.openalex.org; accessed 2026-09-19)
- **Free tier limits**: **max 100,000 credits/day**, **max 100 requests/second** (regardless of credit cost), per free user.
  Source: same as above (accessed 2026-09-19)
- **Polite pool**: supply an email via `mailto=` query param or `User-Agent: ... (mailto:you@example.com)` header for faster/more consistent response times (same pattern as Crossref).
  Source: same as above (accessed 2026-09-19)
- **Field coverage**: `ids` object mapping OpenAlex ID ↔ DOI, MAG, PMID, PMCID; abstract (as `abstract_inverted_index`, reconstructable); authors with ORCID; host venue/journal info; full citation graph (`cited_by_count`, `referenced_works`); open-access status/URL via `open_access` object and `best_oa_location`.
- Note: community reports (Google Groups, secondary) describe OpenAlex moving toward mandatory API keys in places; the primary docs snapshot fetched today still states no key is required for free tier. Treat any "mandatory key" claim as unconfirmed against current primary docs and re-verify before hard-coding assumptions.

### arXiv API
- **API key**: none exists — arXiv API has no authentication/key mechanism at all.
- **Rate limiting**: no published numeric RPS limit; instead a courtesy policy: no more than 1 request per **3 seconds**, and the API docs explicitly discourage bursty/parallel querying.
  Source: https://info.arxiv.org/help/api/tou (accessed 2026-09-19)
- **Pagination cap**: `max_results` capped at **30,000 total results**, retrievable in slices of **at most 2,000 at a time**.
  Source: https://info.arxiv.org/help/api/user-manual.html (accessed 2026-09-19)
- **Field coverage**: title, abstract (`summary`), authors (name only, optional affiliation), primary + subject categories (arXiv/ACM/MSC schemes), `journal_ref` if present, resolved DOI URL if present, links to abstract page / PDF. **No native citation graph** — arXiv metadata is preprint-centric only, DOI is present only if the author/journal later registered one.
- **Freshness semantics**: "new articles are only available to the API on the midnight *after* the articles were processed" — the `<updated>` field reflects that midnight, not real-time submission time. Explicitly: "there is no need to call the API more than once in a day for the same query."
  Source: https://info.arxiv.org/help/api/user-manual.html (accessed 2026-09-19)

### Crossref REST API
- **API key**: **not required** — "No sign-up is required to use the REST API."
  Source: https://www.crossref.org/documentation/retrieve-metadata/rest-api/ (accessed 2026-09-19)
- **Rate limiting**: dynamic, advertised via response headers `X-Rate-Limit-Limit` and `X-Rate-Limit-Interval` (interval always in seconds — e.g., `50` / `1s`). Crossref states these numbers are not fixed and are adjusted "from time to time... to ensure the free API is usable by all" — clients should read the headers rather than hard-code a number.
  Source: https://github.com/CrossRef/rest-api-doc (accessed 2026-09-19)
- **Polite pool**: send `mailto=` query param or identify via `User-Agent` header with contact email **over HTTPS** → routed to a separate, more reliable pool of machines. In effect since 2017-09-18.
  Source: https://github.com/CrossRef/rest-api-doc (accessed 2026-09-19)
- **Paid tier — Metadata Plus**: SLA of 99.5% aggregated uptime, priority support (1 business-day response), isolated/priority-rate-limited infrastructure, bulk data snapshots. Pricing referenced but not itemized on the page fetched — see `/fees/#metadata-plus-subscriber-fees`. Auth via `Crossref-Plus-API-Token: Bearer <token>` header.
  Source: https://www.crossref.org/documentation/metadata-plus/ and https://github.com/CrossRef/rest-api-doc (accessed 2026-09-19)
- **Field coverage**: DOI-centric metadata of record — title, authors, container-title (journal/venue), publisher, ISSN, license/OA links (when deposited), reference lists (only if the publisher deposited them — **coverage is inconsistent**, unlike S2/OpenAlex which build citation graphs independent of publisher deposit). No abstracts for most records (publisher-dependent, sparse).
- **Freshness**: "Records typically appear in the REST API within 20 minutes of their having been successfully deposited with Crossref. Summary information (e.g. counts, etc.) are processed in batch every 24 hours."
  Source: https://github.com/CrossRef/rest-api-doc (accessed 2026-09-19)

---

## 2. Canonical ID scheme

**Core external IDs to normalize on:** DOI (published-version authority), arXiv ID (preprint authority), Semantic Scholar Paper ID / S2 CorpusId (S2's internal canonical key), OpenAlex Work ID (OpenAlex's internal canonical key).

- **S2 → external ID mapping**: every S2 paper object exposes an `externalIds` object that can include DOI, ArXiv, PubMed, PubMedCentral, MAG, DBLP, ACL, and CorpusId simultaneously — i.e., S2 has already done the dedup/merge internally and lets you read off the DOI/arXiv pair for a single canonical S2 record.
  Source: https://api.semanticscholar.org/api-docs/graph (accessed 2026-09-19)
- **OpenAlex → external ID mapping**: each Work exposes an `ids` object (OpenAlex ID, DOI, MAG, PMID, PMCID, and for preprints an arXiv-derived DOI where applicable). OpenAlex also merges preprint and published versions into a single canonical `Work` where it can establish the relationship (via DOI matching and its own dedup pipeline), similar in spirit to S2.

**Practical recommendation for CoResearch (external consumer, not a bibliographic database operator):**
1. Treat **DOI** as the primary join key whenever present (it's the most portable identifier across all four APIs and across publishers).
2. Fall back to **arXiv ID** when no DOI exists yet (i.e., unpublished preprint) — store it as a separate canonical field, not coerced into the DOI field.
3. Use **S2 Paper ID and/or OpenAlex Work ID** as *secondary* cache keys/foreign keys for whichever service supplied the record, but do not treat either as globally canonical — they are provider-internal IDs, not registry IDs like DOI.
4. When both a DOI and an arXiv ID resolve to records from S2 or OpenAlex, prefer the API's own merged record (both services already de-duplicate preprint ↔ published-version pairs server-side) rather than re-implementing merge logic client-side. Only build local merge/dedup logic for the case where CoResearch itself pulls a preprint from arXiv directly and later needs to associate it with a DOI that appears from Crossref/S2/OpenAlex — in that case, key the merge on **normalized DOI string match**, with arXiv ID as a secondary/fallback match key when DOI is absent on one side.
5. Store all available external IDs (DOI, arXiv ID, S2 ID, OpenAlex ID, PubMed/PMCID if present) on the CoResearch `Paper` record from day one, even if only one is used as the primary key — this avoids costly backfill later when cross-referencing across APIs.

---

## 3. Provenance & freshness

- **arXiv**: `<updated>` is **not** a live "last-modified" timestamp in the way a database `updated_at` would be — it reflects "the midnight of the day you called the API," and new submissions only become queryable the midnight *after* processing. arXiv's own guidance: no need to re-query more than once per day for the same query.
  Source: https://info.arxiv.org/help/api/user-manual.html (accessed 2026-09-19)
- **Crossref**: freshness is well-documented and short — records appear within ~20 minutes of deposit; count/summary fields refresh on a 24-hour batch cycle. This is the most reliably "fresh" of the four for DOI-registered metadata.
  Source: https://github.com/CrossRef/rest-api-doc (accessed 2026-09-19)
- **Semantic Scholar / OpenAlex**: neither official page fetched today documents a hard SLA for how quickly a newly-published or newly-deposited paper becomes searchable/indexed. Both ingest from multiple upstream sources (including Crossref and arXiv) plus their own crawls/ML pipelines, so effective latency is a mix of upstream latency + their own indexing cadence — **treat their freshness as best-effort, unspecified**, not a documented guarantee, since neither official doc fetched here states a numeric SLA.

**Implication for "No direct match identified in current search" novelty judgments:** Because none of S2/OpenAlex publish an indexing-latency SLA, and arXiv explicitly is a once-daily batch, a "no match found" result should **not** be treated as permanently authoritative. Recommended re-query interval: **re-run the novelty/no-match check no sooner than 24 hours later** (matches arXiv's own once-daily cadence, the slowest-updating source in the mix), and treat any "no match" judgment as stale after that window — display an explicit "as of [timestamp], re-check recommended after 24h" provenance note to the user rather than presenting it as a permanent fact.

---

## 4. Rate & cost planning (back-of-envelope)

Assumptions (V1, pre-launch estimate — adjust once real usage data exists): ~200 active users, each running ~5 "Direction Exploration" sessions/week, each session issuing ~10 literature-search queries (a mix of S2/OpenAlex/Crossref/arXiv calls) → **~200 × 5 × 10 = 10,000 queries/week ≈ 1,430 queries/day** system-wide, likely bursty around business hours rather than evenly spread across 86,400 seconds/day.

Compared to documented free-tier ceilings:
- **OpenAlex**: 100,000 credits/day, 100 req/s — V1's ~1,430/day is **~1.4% of the daily ceiling**; not remotely a concern even with 10x growth.
- **Crossref**: no fixed daily cap documented (dynamic, header-advertised, commonly cited around tens of req/s in the polite pool) — V1 volume is far under any historically observed limit.
- **arXiv**: no numeric cap, only the courtesy 1-request-per-3-seconds pacing rule — at 1,430/day this is trivially satisfiable if requests are paced (not parallelized), but *is* a design constraint: CoResearch must serialize/rate-limit its own arXiv calls to ≥3s apart, which caps arXiv-specific throughput at ~28,800 requests/day theoretical max if run back-to-back, well above V1 needs, but requires deliberate client-side pacing/queuing rather than firing calls concurrently.
- **Semantic Scholar**: the constraining one — **1 req/s per API key** (authenticated). At 1,430 queries/day evenly paced this is fine (~0.017 req/s average), but burst load (e.g., 10 concurrent users each running a 10-query session at the same moment) could exceed 1 req/s momentarily and get throttled; **without** a key, requests share an unpredictable global pool of other users' unauthenticated traffic, which is riskier for a product with any real usage than working within a dedicated per-key limit.

**Conclusion**: V1's expected volume is **nowhere near** any documented free-tier ceiling for OpenAlex, Crossref, or arXiv. The binding constraint is Semantic Scholar's 1 RPS per key, which requires client-side request queuing/backoff (not a paid tier) to avoid bursty 429s. No paid tier is justified for V1 launch; revisit if usage grows ~50-100x (i.e., thousands of active users) or if CoResearch needs guaranteed low-latency/SLA-backed access (at which point Crossref Metadata Plus or an upgraded S2 API key allowance are the first tiers to consider, since OpenAlex's free ceiling is high enough to absorb substantial growth without a paid plan).

---

## Summary / Recommendation

**Primary APIs**: Use **Semantic Scholar** as the primary source for citation-graph-rich queries (it has the richest paper-level `externalIds` mapping and a built-in citation graph) and **OpenAlex** as a complementary/fallback source given its much higher free-tier ceiling (100k credits/day, 100 req/s) and equally strong ID-mapping (`ids` object) — this pairing gives redundancy if either service is degraded. Use **Crossref** specifically for DOI-authoritative metadata resolution (freshest of the four, ~20 min from deposit) and **arXiv** specifically for preprint-only content not yet DOI-registered, respecting its 3-second courtesy pacing and once-daily update cadence.

**Canonicalization**: normalize on **DOI** as primary key when present, **arXiv ID** as fallback/secondary field for preprints, and store S2 Paper ID + OpenAlex Work ID as provider-specific foreign keys rather than the canonical key — both S2 and OpenAlex already perform preprint/published-version merging server-side, so lean on their merged records instead of re-implementing dedup logic, and only do local DOI-string-match merging for cases CoResearch assembles itself (e.g., an arXiv-only ingest later needing to join to a Crossref/S2 DOI record).

**Freshness**: because none of the four APIs publish a real-time indexing SLA (arXiv is explicitly once-daily; S2/OpenAlex are undocumented/best-effort; only Crossref documents ~20-minute freshness), set the **novelty/no-match re-query interval at 24 hours** and surface an explicit "as of [timestamp]" provenance note on any "no direct match" judgment rather than treating it as permanent.

**Cost/rate planning**: at V1's estimated ~1,430 queries/day, all four APIs' free tiers comfortably cover expected volume — OpenAlex's ceiling alone is ~70x that volume. The one real constraint is Semantic Scholar's 1 req/s per API key, which calls for client-side request queuing/backoff in the Method/Evaluation implementation, not a paid tier. **No paid tier is needed for V1 launch**; revisit Crossref Metadata Plus or an elevated S2 key allowance only if usage grows roughly 50-100x or CoResearch needs an uptime/latency SLA.
