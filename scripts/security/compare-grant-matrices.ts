import { readFile, writeFile } from "node:fs/promises";

type Grant = Record<string, unknown>;
type Matrix = Record<string, Grant[]>;
type Artifact = { matrix: Matrix };

const tableClassifications: Record<string, string> = {
  allowed_signup_emails: "ADMIN_ONLY",
  body_measurements: "USER_OWNED",
  cardio_logs: "USER_OWNED",
  equipment: "GLOBAL_READ",
  exercise_aliases: "SERVER_ONLY",
  exercise_equipment: "GLOBAL_READ",
  exercise_media: "GLOBAL_READ",
  exercise_substitutions: "GLOBAL_READ",
  exercises: "GLOBAL_READ",
  media_licenses: "SERVER_ONLY",
  media_review_events: "SERVER_ONLY",
  profiles: "USER_OWNED",
  set_logs: "USER_OWNED",
  training_preferences: "USER_OWNED",
  user_equipment: "USER_OWNED",
  user_exercise_preferences: "USER_OWNED",
  user_goals: "USER_OWNED",
  workout_day_exercises: "USER_OWNED",
  workout_days: "USER_OWNED",
  workout_plans: "USER_OWNED",
  workout_session_exercises: "USER_OWNED",
  workout_sessions: "USER_OWNED",
};

const local = JSON.parse(
  await readFile("data/security/grant-matrix-local.json", "utf8"),
) as Artifact;
const production = JSON.parse(
  await readFile("data/security/grant-matrix-production.json", "utf8"),
) as Artifact;
const proposed = JSON.parse(
  await readFile("data/security/grant-matrix-proposed-v161-r2.json", "utf8"),
) as Artifact;
const categories = [
  "tables",
  "sequences",
  "functions",
  "functionInventory",
  "schemas",
  "defaultPrivileges",
] as const;
const stable = (value: Grant) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
const result: Record<
  string,
  { extraProduction: Grant[]; missingProduction: Grant[]; matching: Grant[] }
> = {};
for (const category of categories) {
  const localRows = local.matrix[category] ?? [];
  const productionRows = production.matrix[category] ?? [];
  const localKeys = new Set(localRows.map(stable));
  const productionKeys = new Set(productionRows.map(stable));
  result[category] = {
    extraProduction: productionRows.filter(
      (row) => !localKeys.has(stable(row)),
    ),
    missingProduction: localRows.filter(
      (row) => !productionKeys.has(stable(row)),
    ),
    matching: localRows.filter((row) => productionKeys.has(stable(row))),
  };
}
const tableNames = [
  ...new Set([
    ...local.matrix.tables.map((row) => String(row.object)),
    ...production.matrix.tables.map((row) => String(row.object)),
  ]),
].sort();
const roles = ["anon", "authenticated", "service_role", "supabase_auth_admin"];
const privileges = (matrix: Matrix, table: string, role: string) =>
  matrix.tables
    .filter((row) => row.object === table && row.role === role)
    .map((row) => String(row.privilege))
    .sort();
const subtract = (left: string[], right: string[]) =>
  left.filter((item) => !right.includes(item));
const tableMatrix = tableNames.map((table) => ({
  schema: "public",
  table,
  classification: tableClassifications[table] ?? "OTHER",
  rlsEnabled: Boolean(
    local.matrix.tables.find((row) => row.object === table)?.rlsEnabled,
  ),
  roles: Object.fromEntries(
    roles.map((role) => {
      const localPrivileges = privileges(local.matrix, table, role);
      const productionPrivileges = privileges(production.matrix, table, role);
      const proposedPrivileges = privileges(proposed.matrix, table, role);
      return [
        role,
        {
          localPrivileges,
          productionPrivileges,
          proposedPrivileges,
          extraProductionVsLocal: subtract(
            productionPrivileges,
            localPrivileges,
          ),
          missingProductionVsLocal: subtract(
            localPrivileges,
            productionPrivileges,
          ),
          extraProductionVsProposed: subtract(
            productionPrivileges,
            proposedPrivileges,
          ),
          missingProductionVsProposed: subtract(
            proposedPrivileges,
            productionPrivileges,
          ),
        },
      ];
    }),
  ),
}));
const proposedDiff: typeof result = {};
for (const category of categories) {
  const proposedRows = proposed.matrix[category] ?? [];
  const productionRows = production.matrix[category] ?? [];
  const proposedKeys = new Set(proposedRows.map(stable));
  const productionKeys = new Set(productionRows.map(stable));
  proposedDiff[category] = {
    extraProduction: productionRows.filter(
      (row) => !proposedKeys.has(stable(row)),
    ),
    missingProduction: proposedRows.filter(
      (row) => !productionKeys.has(stable(row)),
    ),
    matching: proposedRows.filter((row) => productionKeys.has(stable(row))),
  };
}
await writeFile(
  "data/security/grant-diff-v161-r2.json",
  `${JSON.stringify(
    {
      version: "1.6.1-R2",
      observedBaseline: "local reset with migrations 001-012",
      canonical: "proposed least-privilege ACL",
      productionProjectRef: "inghftngeritrsezwxnm",
      ...result,
      tableMatrix,
      proposedReconciliation: proposedDiff,
    },
    null,
    2,
  )}\n`,
);
for (const category of categories) {
  const item = result[category];
  process.stdout.write(
    `${category}: matching=${item.matching.length} extra=${item.extraProduction.length} missing=${item.missingProduction.length}\n`,
  );
}
