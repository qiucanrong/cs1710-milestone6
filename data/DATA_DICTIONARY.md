# Columns

`fips` is the join key everywhere. **Read it as a string** (`dtype={"fips": str}` /
`d3.csv` keeps it) or the leading zero disappears and every Alaska and New England
county silently fails to join.

## counties.csv — 3,143 rows, one per county

| column | type | meaning | source |
|---|---|---|---|
| `fips` | categorical | 5-char county code, zero-padded. **Join key** | Census |
| `county` `state` `state_abbr` | categorical | names | AHRF |
| `lon` `lat` | quantitative | county centroid, WGS84 | PLACES / Census TopoJSON |
| `rural_urban_code` | **ordinal** | USDA continuum, 1 big metro … 9 most rural | USDA via AHRF |
| `metro` | categorical | 1 if code ≤ 3 | derived |
| `women_15_44` | quantitative | **the denominator for everything.** Weight averages by this | AHRF |
| `births_annual` | quantitative | live births, 12 months to Jun 2024 | AHRF |
| `policy_tier` | **ordinal** | Guttmacher's 7 tiers, `Most Restrictive` … `Most Protective` | Guttmacher |
| `policy_rank` | **ordinal** | 1 = Most Restrictive … 7 = Most Protective. **Sort on this**, not the string | Guttmacher |
| `drive_miles_may2022` | quantitative | road miles to nearest open abortion clinic, last pre-Dobbs month | Myers |
| `drive_miles_jul2026` | quantitative | same, latest month | Myers |
| `drive_miles_change` | quantitative | `jul2026 − may2022`. Positive = worse | derived |
| `access_band` | **ordinal** | `<=25 mi` `26-99 mi` `100-249 mi` `>=250 mi` | derived |
| `nearest_provider_state` | categorical | which state the nearest clinic sits in now | Myers |
| `crossed_state_line` | categorical | 1 if that state is not this county's own | derived |
| `obgyn` | quantitative | OB-GYNs, MD + DO, non-federal, 2023 | AHRF |
| `obgyn_per_10k_women` | quantitative | per 10,000 women 15–44. **The supply measure** | derived |
| `obgyn_band` | **ordinal** | `more than 2.5 per 10k` / `0.1 to 2.5 per 10k` / `none at all` | derived |
| `no_obgyn` | categorical | 1 if zero OB-GYNs. **True for 48% of counties** | derived |
| `ob_hospitals` | quantitative | hospitals providing obstetric care, 2023 | AHRF |
| `no_ob_hospital` | categorical | 1 if zero | derived |
| `hit_twice` | categorical | 1 if ≥100 miles **and** no OB-GYN. 626 counties | derived |
| `uninsured_pct` | quantitative | adults 18–64 with no insurance | PLACES |
| `no_transport_pct` | quantitative | lacked reliable transport in past year | PLACES |
| `checkup_pct` | quantitative | routine checkup in past year | PLACES |
| `cervical_screening_pct` | quantitative | women 21–65 screened | PLACES |
| `mammography_pct` | quantitative | women 50–74, past 2 years | PLACES |
| `teen_birth_rate_2020` | quantitative | births per 1,000 females 15–19. **2020 is the last county year NCHS publishes** — a pre-Dobbs baseline, it cannot show an effect | NCHS |

Coverage is 100% except: `no_transport_pct` 73%, `uninsured_pct` / `checkup_pct` 94%
(PLACES does not model every county), and all five PLACES columns are null for
Connecticut's 8 counties — see the note at the bottom.

## state_outcomes_by_year.csv — 400 rows, 50 states × 2017–2024

`state` `state_abbr` `policy_tier` `policy_rank` `year` `post_dobbs` (1 from 2023)
`live_births` `infant_deaths` `infant_mortality_per_1000` `rate_unreliable`
`preterm_pct` (< 37 weeks) `very_preterm_pct` (< 32 weeks)

`rate_unreliable` = 1 on the 4 Vermont rows where WONDER built the rate on fewer than
20 deaths. The rate is still there; flag it or drop it, but know it is there.

## states.csv — 50 rows
State rollups of the above plus `facilities_may2022` / `facilities_jul2026` /
`facilities_change` (open clinic counts, Myers) and `median_drive_change`.

## county_distance_monthly.csv — 285,922 rows
`fips` `ym` (`2022-05`) `drive_miles` `post_dobbs`. Monthly, Jan 2019 – Jul 2026.
For a time slider.

## chain_by_group.csv — 140 rows, already aggregated
Long format: one row per group per link. `value_pct` is **already weighted by
women 15–44** so you cannot get the weighting wrong. Filter `group_type` to one of:
`All`, `Policy tier`, `Policy tier x county type`, `County type`, `Distance band`.
Links in order: insured → has transport → routine checkup → cervical screening →
mammogram. Each has its own `denominator` — it is a profile of five measures,
**not a funnel**; nobody survives from one link to the next.

## access_trend_by_tier.csv — 637 rows, already aggregated
`policy_rank` `policy_tier` `ym` `post_dobbs` `median_drive_miles`
`mean_drive_miles_weighted` `pct_counties_over_100mi` `n_counties`.

---

## Four things to know

1. **Policy is a state variable.** Every Texas county shares `policy_tier`. Counties
   differ on distance, capacity and PLACES — not on policy.
2. **Weight by `women_15_44`.** A plain mean over counties gives Loving County, TX
   (pop. 64) the same say as Los Angeles. `chain_by_group.csv` already does this.
3. **`rural_urban_code` confounds nearly everything.** Restrictive states are more
   rural, and rural counties had fewer OB-GYNs long before Dobbs. Check
   `Policy tier x county type` in `chain_by_group.csv` before claiming a policy effect.
   The gap survives, but it shrinks a lot.
4. **PLACES values are modelled estimates**, not counts. Fine for ranking and mapping,
   not for quoting a precise local number.

**Connecticut.** AHRF carries CT twice: the legacy counties (`09001`–`09015`) hold the
OB-GYN counts and population and match the Myers distance panel; the 2022 planning
regions hold only births and PLACES. We kept the legacy counties, so CT has capacity
and distance but no PLACES columns and no `births_annual`. It is 8 of 3,143 rows.
