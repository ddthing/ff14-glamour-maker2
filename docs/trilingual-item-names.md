# Three-language equipment names

Cards and equipped-item rows show the selected UI language first, followed by the other available Korean, English, and Japanese names. Identical names appear once. Missing names are omitted, never machine-translated or replaced with invented names.

Names are joined by item ID using the existing Korean snapshot and XIVAPI search endpoint. The client requests only missing languages, merges duplicate in-flight requests, limits translation requests to four at a time, times out individual requests after eight seconds, and backs off unavailable names for thirty seconds. Completed names are stored with the existing item records. Responses from a deleted workspace cannot restore those records.

Each secondary name has its own block and language attribute. PNG preparation waits for name hydration and then captures the current equipment text positions. The previously missing boardGearList element reference is now provided so solo and two-person exports can use those captured positions. The Canvas fallback preserves explicit language line breaks as well.

Regression coverage includes 1/2/5-character cards, all three primary languages, duplicate and unavailable names, concurrent request limits, saved-name restoration, mobile overflow, and complete secondary-name capture for PNG.

Scope: UI language still controls labels and title defaults. User-authored titles are unchanged. TypeSafe's code-owned exact lookup principle applies here; no TypeSafe inference or API credentials are needed to retrieve official item names.
