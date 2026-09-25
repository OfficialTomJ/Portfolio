# Performance journal trade exceptions

An exception hides one Bybit position cycle from the public Performance Journal without deleting its private evidence. Mark the exact document in `performance_private_position_cycles` with `excludedFromJournal: true`, `status: "excluded"`, `excludedAt`, and `exclusionReason: "user_request"` only after verifying its symbol and opening time against the intended trade. Do not use a symbol-wide filter: a later trade in the same asset may be valid.

The sync continues to archive raw snapshots and associate closed PnL with the cycle, but it never publishes an excluded cycle. If the account briefly reports that position as active again, the exception marker survives and the cycle remains excluded. Public journal and direct trade-page reads also exclude the deterministic trade ID, including when a public document already exists. Existing raw records and snapshot archives remain available for investigation.

After applying an exception, verify that the intended cycle has the marker, adjacent cycles do not, the public journal omits its trade, and the next sync succeeds without publishing it. An existing immutable social image URL, if one was previously generated and shared, requires separate review because journal filtering does not remove stored image history.
