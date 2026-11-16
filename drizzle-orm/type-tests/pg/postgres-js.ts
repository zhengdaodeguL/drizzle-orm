import postgres, { type Sql } from 'postgres';
import { integer, pgTable } from '~/pg-core/index.ts';
import { drizzle } from '~/postgres-js/index.ts';
import { sql } from '~/sql/sql.ts';
import { type Equal, Expect } from '../utils.ts';

export async function reservedSql() {
	const pool = postgres();
	const poolDb = drizzle(pool);
	Expect<Equal<typeof poolDb.$client, typeof pool>>;

	const connectionDb = drizzle({ connection: 'postgres://localhost/drizzle' });
	Expect<Equal<typeof connectionDb.$client, Sql>>;
	const connectionStringDb = drizzle('postgres://localhost/drizzle');
	Expect<Equal<typeof connectionStringDb.$client, Sql>>;

	const reserved = await pool.reserve();
	const client = Object.assign(reserved, { options: pool.options });
	const db = drizzle({ client });
	Expect<Equal<typeof db.$client, typeof client>>;
	await db.execute(sql`select 1`);

	const directDb = drizzle(client);
	Expect<Equal<typeof directDb.$client, typeof client>>;

	const users = pgTable('users', { id: integer().notNull() });
	const schema = { users };
	const schemaDb = drizzle(client, { schema });
	const configDb = drizzle({ client, schema });
	Expect<Equal<typeof schemaDb.$client, typeof client>>;
	Expect<Equal<typeof configDb.$client, typeof client>>;

	const rows = await schemaDb.select().from(users);
	const relationalRows = await configDb.query.users.findMany();
	Expect<Equal<typeof rows, { id: number }[]>>;
	Expect<Equal<typeof relationalRows, { id: number }[]>>;

	const withoutOptions: Omit<typeof client, 'options'> = client;
	// @ts-expect-error The adapter needs the pool's parsers and serializers.
	drizzle({ client: withoutOptions });

	db.$client.release();
}
