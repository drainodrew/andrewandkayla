-- An internal, planning-only name for a table: "UNC friends", "work friends",
-- "Kayla's cousins".
--
-- Kept separate from `label` rather than replacing it. `label` is the number
-- guests will see on an escort card ("Table 7"); this is the shorthand Andrew
-- and Kayla actually think in while arranging people. Overloading one field
-- would force a choice between a plan you can reason about and a plan you can
-- hand to the caterer.
--
-- Nullable: most tables never get one.

alter table floor_plan_objects add column internal_name text;
