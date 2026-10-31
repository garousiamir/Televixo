# Reports

Implementation: `Reporting/Reports.php`. Ranges are inclusive local dates in the **site time zone**, converted to UTC boundaries (DST-correct via PHP's tz database). Maximum range 366 days.

| Metric | Definition |
|---|---|
| Conversations | Created in range, excluding spam. |
| Unanswered | Created in range, has at least one visitor message, and no human operator reply. Automated messages never count. |
| First human response | First human operator reply − first visitor message (median and mean, seconds). |
| Resolution time | `closed_at − created_at` for conversations whose latest close falls in range. A reopened and re-closed conversation counts once with its latest close; `reopened` reports how many conversations created in range were reopened at least once. |
| Queue wait | First assignment − first time queued. |
| CSAT | Mean score (1–5) and share of 4–5 ratings submitted in range. |
| Operator performance | Assignments started, public replies sent, median first response where the operator answered first, CSAT on conversations assigned to them. |
| Team volume | Conversations per team (or none). |
| Automation conversion | Per rule: distinct visitors shown an attention action, and how many started a conversation within 30 minutes. |
| Daily series | Conversations per local day. |

Verified by `tests/php/ReportsTest.php` (automation exclusion, spam exclusion, medians, CSAT).
